/**
 * 上传服务
 * 负责调用分享平台 API 上传记录，处理认证、错误处理和重试逻辑
 */

import { UploadRecord, UploadConfig, UploadResponse, UploadErrorResponse } from '../models/uploadRecord';
import { ApiClient, HttpError, TimeoutError } from '../utils/apiClient';
import { Logger } from '../utils/logger';
import { sanitizeForUpload, getSanitizationReport, hasSurrogates } from '../utils/textSanitizer';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * 上传服务接口
 */
export interface IUploadService {
    /**
     * 上传记录到分享平台
     * @param record 上传记录数据
     * @param config 上传配置（JWT Token、API URL）
     * @returns 上传响应数据
     * @throws UploadError 上传失败时抛出错误
     */
    uploadRecord(record: UploadRecord, config: UploadConfig): Promise<UploadResponse>;

    /**
     * 验证 JWT Token 是否有效
     * @param token JWT Token
     * @returns Token 是否有效
     */
    validateToken(token: string): Promise<boolean>;

    /**
     * 测试 API 连接
     * @param config 上传配置
     * @returns 连接是否成功
     */
    testConnection(config: UploadConfig): Promise<boolean>;
}

/**
 * 上传错误基类
 */
export class UploadError extends Error {
    constructor(
        public code: string,
        message: string,
        public details?: {
            field?: string;
            reason?: string;
        }
    ) {
        super(message);
        this.name = 'UploadError';
    }
}

/**
 * 验证错误
 */
export class ValidationError extends UploadError {
    constructor(message: string, details?: { field?: string; reason?: string }) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'ValidationError';
    }
}

/**
 * 认证错误
 */
export class AuthenticationError extends UploadError {
    constructor(message: string = '认证失败，请更新 JWT Token') {
        super('UNAUTHORIZED', message);
        this.name = 'AuthenticationError';
    }
}

/**
 * 负载过大错误
 */
export class PayloadTooLargeError extends UploadError {
    constructor(message: string = '内容大小超过10MB限制') {
        super('PAYLOAD_TOO_LARGE', message);
        this.name = 'PayloadTooLargeError';
    }
}

/**
 * 服务器错误
 */
export class ServerError extends UploadError {
    constructor(message: string = '服务器错误，请稍后重试') {
        super('INTERNAL_ERROR', message);
        this.name = 'ServerError';
    }
}

/**
 * 网络错误
 */
export class NetworkError extends UploadError {
    constructor(message: string = '网络连接失败，请检查网络设置') {
        super('NETWORK_ERROR', message);
        this.name = 'NetworkError';
    }
}

/**
 * 上传服务实现
 */
export class UploadService implements IUploadService {
    private readonly apiClient: ApiClient;
    private readonly maxRetries = 3;
    private readonly retryDelays = [1000, 2000, 4000]; // 指数退避：1秒、2秒、4秒
    private readonly timeout = 30000; // 30秒

    constructor() {
        this.apiClient = new ApiClient();
    }

    /**
     * 上传记录到分享平台
     */
    async uploadRecord(record: UploadRecord, config: UploadConfig): Promise<UploadResponse> {
        const url = `${config.api_url}/records`;
        
        // 第一步：清理内容中的非法字符（孤立的代理字符等）
        let cleanedContent = record.content;
        if (hasSurrogates(record.content)) {
            Logger.warn('Content contains orphaned surrogate characters, sanitizing...');
            cleanedContent = sanitizeForUpload(record.content);
            
            const report = getSanitizationReport(record.content, cleanedContent);
            Logger.info(`Sanitization report: removed ${report.surrogateCount} orphaned surrogates, ` +
                       `length ${report.originalLength} -> ${report.cleanedLength}`);
        }
        
        // 使用清理后的内容
        record = { ...record, content: cleanedContent };
        
        // 检查内容大小，决定是否需要压缩
        const contentSize = Buffer.byteLength(record.content, 'utf8');
        const shouldCompress = contentSize > 500 * 1024; // 大于500KB就压缩
        
        let requestBody: any = record;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.jwt_token}`
        };

        // 如果内容较大，尝试压缩
        if (shouldCompress) {
            try {
                const compressedRecord = await this.compressRecord(record);
                const compressedSize = Buffer.byteLength(JSON.stringify(compressedRecord), 'utf8');
                const compressionRatio = (compressedSize / contentSize * 100).toFixed(1);
                
                Logger.info(`Content size: ${(contentSize / 1024).toFixed(1)}KB -> ${(compressedSize / 1024).toFixed(1)}KB (${compressionRatio}% compression)`);
                
                // 如果压缩后小于800KB，使用压缩版本（留一些余量）
                if (compressedSize < 800 * 1024) {
                    requestBody = compressedRecord;
                    headers['X-Content-Encoding'] = 'gzip-base64';
                    Logger.info('Using compressed content for upload');
                } else {
                    Logger.warn('Compressed content still too large, using original (may fail)');
                }
            } catch (error) {
                Logger.warn(`Compression failed, using original content: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        let lastError: Error | null = null;
        const startTime = Date.now();

        // 重试逻辑
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                // 使用skipAuth=true，因为我们已经手动设置了Authorization header
                // 这样可以避免ApiClient尝试从tokenManager获取token（可能未设置或过期）
                const response = await this.apiClient.request<UploadResponse | UploadErrorResponse>(
                    url,
                    {
                        method: 'POST',
                        headers: headers,
                        body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
                        timeout: this.timeout
                    },
                    true, // skipAuth = true，使用手动设置的Authorization header
                    true  // retryOn401 = true，仍然处理401错误
                );

                // 检查响应是否为错误响应
                if ('error' in response.data) {
                    const errorResponse = response.data as UploadErrorResponse;
                    throw this.parseErrorResponse(response.status, errorResponse);
                }

                // 成功响应
                const uploadResponse = response.data as UploadResponse;
                return uploadResponse;

            } catch (error) {
                lastError = error as Error;

                // 如果是413错误（Payload Too Large），尝试分块上传
                if (error instanceof PayloadTooLargeError || 
                    (error instanceof HttpError && error.status === 413)) {
                    Logger.warn('Payload too large, attempting chunked upload...');
                    try {
                        return await this.uploadRecordInChunks(record, config);
                    } catch (chunkError) {
                        Logger.error('Chunked upload also failed', chunkError as Error);
                        throw new PayloadTooLargeError(`内容过大且分块上传失败: ${chunkError instanceof Error ? chunkError.message : String(chunkError)}`);
                    }
                }

                // 对于其他用户错误，不重试
                if (this.isUserError(error)) {
                    Logger.error(`Upload failed (user error): ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }

                // 对于可重试的错误，等待后重试
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelays[attempt];
                    Logger.info(`Upload failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
                    await this.sleep(delay);
                } else {
                    Logger.error(`Upload failed after ${this.maxRetries + 1} attempts`);
                }
            }
        }

        // 所有重试都失败
        if (lastError instanceof UploadError) {
            throw lastError;
        }
        throw new NetworkError(`上传失败：${lastError?.message || '未知错误'}`);
    }

    /**
     * 解析错误响应
     */
    private parseErrorResponse(status: number, errorResponse: UploadErrorResponse): UploadError {
        const error = errorResponse.error;
        let message = error.message || '未知错误';
        const details = error.details;

        // 针对常见错误提供更友好的消息
        if (status === 400) {
            // 检查是否是编码错误
            if (message.includes('utf-8') || message.includes('encode') || message.includes('surrogate')) {
                message = '内容包含无法编码的特殊字符。插件已尝试自动清理，但仍然失败。' +
                          '建议：请检查内容中是否包含损坏的 emoji 或特殊字符。\n' +
                          `原始错误: ${message}`;
            }
        }

        switch (status) {
            case 400:
                return new ValidationError(message, details);
            case 401:
                return new AuthenticationError(message);
            case 413:
                return new PayloadTooLargeError(message);
            case 500:
                return new ServerError(message);
            default:
                return new UploadError('UNKNOWN_ERROR', message, details);
        }
    }

    /**
     * 判断是否为用户错误（不应重试）
     */
    private isUserError(error: any): boolean {
        return error instanceof ValidationError ||
               error instanceof AuthenticationError ||
               error instanceof PayloadTooLargeError ||
               (error instanceof HttpError && (error.status === 400 || error.status === 401 || error.status === 413));
    }

    /**
     * 验证 JWT Token 是否有效
     */
    async validateToken(token: string): Promise<boolean> {
        try {
            // 检查 Token 格式（JWT 格式：三部分，用点分隔）
            const parts = token.split('.');
            if (parts.length !== 3) {
                Logger.warn('Invalid JWT token format');
                return false;
            }

            // 解析 payload（第二部分）
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            // 检查过期时间
            const exp = payload.exp;
            if (exp && exp * 1000 < Date.now()) {
                Logger.warn('JWT token has expired');
                return false;
            }

            return true;
        } catch (error) {
            Logger.warn(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * 测试 API 连接
     */
    async testConnection(config: UploadConfig): Promise<boolean> {
        try {
            const healthUrl = `${config.api_url}/health`;
            const response = await this.apiClient.get(healthUrl, {}, 5000); // 5秒超时
            return response.ok && response.status === 200;
        } catch (error) {
            Logger.warn(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * 睡眠函数（用于重试延迟）
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 压缩记录内容
     * 使用gzip压缩content字段，并转换为base64
     */
    private async compressRecord(record: UploadRecord): Promise<any> {
        try {
            // 压缩content字段
            const contentBuffer = Buffer.from(record.content, 'utf8');
            const compressed = await gzip(contentBuffer, { level: 9 }); // 最高压缩级别
            const compressedBase64 = compressed.toString('base64');

            // 返回新的记录对象，content字段替换为压缩后的base64字符串
            return {
                ...record,
                content: compressedBase64,
                _compressed: true // 标记为已压缩
            };
        } catch (error) {
            Logger.error('Failed to compress record', error as Error);
            throw error;
        }
    }

    /**
     * 分块上传记录（当压缩仍然无法满足时使用）
     * 将记录分成多个块，依次上传，服务器端合并
     */
    async uploadRecordInChunks(record: UploadRecord, config: UploadConfig): Promise<UploadResponse> {
        // 清理内容中的非法字符
        let cleanedContent = record.content;
        if (hasSurrogates(record.content)) {
            Logger.warn('Content contains orphaned surrogate characters in chunked upload, sanitizing...');
            cleanedContent = sanitizeForUpload(record.content);
            record = { ...record, content: cleanedContent };
        }
        
        const CHUNK_SIZE = 700 * 1024; // 每块700KB（安全余量）
        const contentSize = Buffer.byteLength(record.content, 'utf8');
        const totalChunks = Math.ceil(contentSize / CHUNK_SIZE);

        Logger.info(`Content too large (${(contentSize / 1024).toFixed(1)}KB), splitting into ${totalChunks} chunks`);

        // 生成唯一的上传ID
        const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 分块上传
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, contentSize);
            const chunkContent = record.content.substring(start, end);

            const chunkData = {
                upload_id: uploadId,
                chunk_index: chunkIndex,
                total_chunks: totalChunks,
                chunk_content: chunkContent,
                // 只在第一个块中包含元数据
                ...(chunkIndex === 0 ? {
                    project_name: record.project_name,
                    uploader_email: record.uploader_email,
                    upload_time: record.upload_time,
                    content_format: record.content_format
                } : {})
            };

            const url = `${config.api_url}/records/upload-chunk`;
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.jwt_token}`
            };

            try {
                Logger.info(`Uploading chunk ${chunkIndex + 1}/${totalChunks} (${(Buffer.byteLength(chunkContent, 'utf8') / 1024).toFixed(1)}KB)`);
                
                const response = await this.apiClient.post<any>(
                    url,
                    chunkData,
                    headers,
                    this.timeout
                );

                if (response.data.error) {
                    throw new Error(response.data.error.message || 'Chunk upload failed');
                }

                // 最后一个块会返回完整的上传响应
                if (chunkIndex === totalChunks - 1 && response.data.data) {
                    Logger.info(`All chunks uploaded successfully: ${response.data.data.id}`);
                    return response.data as UploadResponse;
                }
            } catch (error) {
                Logger.error(`Failed to upload chunk ${chunkIndex + 1}/${totalChunks}`, error as Error);
                throw new NetworkError(`分块上传失败（块 ${chunkIndex + 1}/${totalChunks}）: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        throw new Error('Chunked upload completed but no response received');
    }
}

