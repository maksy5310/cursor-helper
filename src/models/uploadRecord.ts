/**
 * 上传记录数据模型
 */

/**
 * 内容格式枚举
 */
export enum ContentFormat {
    MARKDOWN = "markdown",
    TEXT = "text",
    JSON = "json",
    HTML = "html"
}

/**
 * 上传记录接口
 */
export interface UploadRecord {
    title: string;                 // 会话标题（1-255字符）
    project_name: string;          // 项目名称（1-255字符）
    uploader_email: string;        // 上传人邮箱（有效邮箱格式）
    upload_time: string;           // 上传时间（ISO 8601格式，不能是未来时间）
    content_format: ContentFormat; // 内容格式（默认'markdown'）
    content: string;               // 内容（最大10MB）
}

/**
 * 验证错误接口
 */
export interface ValidationErrors {
    title?: string;                // 标题验证错误
    project_name?: string;          // 项目名称验证错误
    uploader_email?: string;        // 邮箱验证错误
    upload_time?: string;          // 时间验证错误
    content?: string;              // 内容验证错误
}

/**
 * 上传表单数据接口
 */
export interface UploadFormData {
    title: string;                 // 会话标题
    project_name: string;          // 项目名称
    uploader_email: string;        // 上传人邮箱
    upload_time: string;           // 上传时间（ISO 8601格式）
    content_format: ContentFormat; // 内容格式
    content: string;               // 内容（从数据库加载的会话内容，可编辑）
    composer_id?: string;           // 会话ID（composerId，用于从数据库加载会话）
    validation_errors?: ValidationErrors; // 验证错误（可选）
}

/**
 * 上传响应接口
 */
export interface UploadResponse {
    data: {
        id: string;                   // 记录ID（UUID）
        title: string;                // 会话标题
        project_name: string;         // 项目名称
        uploader_email: string;      // 上传人邮箱
        upload_time: string;         // 上传时间
        content_format: ContentFormat; // 内容格式
        content: string;             // 内容
        is_shared: boolean;          // 是否已分享
        created_at: string;          // 创建时间
        updated_at: string;          // 更新时间
    };
    message: string;               // 响应消息
}

/**
 * 上传错误响应接口
 */
export interface UploadErrorResponse {
    error: {
        code: string;                // 错误代码
        message: string;             // 错误消息
        details?: {
            field?: string;            // 字段名（验证错误时）
            reason?: string;           // 具体原因（验证错误时）
        };
    };
}

/**
 * 上传配置接口
 */
export interface UploadConfig {
    jwt_token: string;             // JWT Token（用于认证）
    api_url: string;               // 分享平台API基础URL
}

/**
 * 本地记录文件接口
 */
export interface LocalRecordFile {
    file_path: string;         // 文件路径
    file_name: string;         // 文件名
    file_size: number;         // 文件大小（字节）
    created_at: string;        // 创建时间（ISO 8601格式）
    date: string;             // 日期（yyyy-mm-dd格式，用于排序）
}

/**
 * 验证标题
 * @param title 会话标题
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateTitle(title: string): string | undefined {
    if (!title || title.trim().length === 0) {
        return '会话标题不能为空';
    }
    if (title.length < 1 || title.length > 255) {
        return '会话标题必须为1-255字符';
    }
    return undefined;
}

/**
 * 验证项目名称
 * @param project_name 项目名称
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateProjectName(project_name: string): string | undefined {
    if (!project_name || project_name.trim().length === 0) {
        return '项目名称不能为空';
    }
    if (project_name.length < 1 || project_name.length > 255) {
        return '项目名称必须为1-255字符';
    }
    return undefined;
}

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateEmail(email: string): string | undefined {
    if (!email || email.trim().length === 0) {
        return '邮箱不能为空';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return '请输入有效的邮箱地址';
    }
    return undefined;
}

/**
 * 验证上传时间
 * @param upload_time 上传时间（ISO 8601格式）
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateUploadTime(upload_time: string): string | undefined {
    if (!upload_time || upload_time.trim().length === 0) {
        return '上传时间不能为空';
    }
    
    try {
        const time = new Date(upload_time);
        if (isNaN(time.getTime())) {
            return '请输入有效的时间格式（ISO 8601）';
        }
        
        // 检查是否为 ISO 8601 格式
        if (time.toISOString() !== upload_time && time.toISOString().slice(0, -1) + 'Z' !== upload_time) {
            // 允许一些变体格式
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
            if (!isoRegex.test(upload_time)) {
                return '时间格式必须为 ISO 8601 格式（例如：2025-12-15T10:00:00Z）';
            }
        }
        
        // 检查是否为未来时间
        if (time > new Date()) {
            return '时间不能是未来时间';
        }
        
        return undefined;
    } catch (error) {
        return '时间格式无效';
    }
}

/**
 * 验证内容格式
 * @param format 内容格式
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateContentFormat(format: string): string | undefined {
    if (!format) {
        return undefined; // 可选字段，允许为空
    }
    const validFormats = Object.values(ContentFormat);
    if (!validFormats.includes(format as ContentFormat)) {
        return `内容格式必须是以下之一：${validFormats.join(', ')}`;
    }
    return undefined;
}

/**
 * 验证内容大小
 * @param content 内容
 * @param maxSizeMB 最大大小（MB），默认 10MB
 * @returns 验证错误消息，如果有效则返回 undefined
 */
export function validateContentSize(content: string, maxSizeMB: number = 10): string | undefined {
    if (!content || content.length === 0) {
        return '内容不能为空';
    }
    
    // 计算内容大小（字节）
    const sizeInBytes = new Blob([content]).size;
    const maxSizeInBytes = maxSizeMB * 1024 * 1024;
    
    if (sizeInBytes > maxSizeInBytes) {
        return `内容大小不能超过 ${maxSizeMB}MB（当前：${(sizeInBytes / 1024 / 1024).toFixed(2)}MB）`;
    }
    
    return undefined;
}

/**
 * 验证上传记录
 * @param record 上传记录
 * @returns 验证错误对象，如果有效则返回空对象
 */
export function validateUploadRecord(record: UploadRecord): ValidationErrors {
    const errors: ValidationErrors = {};
    
    const titleError = validateTitle(record.title);
    if (titleError) {
        errors.title = titleError;
    }
    
    const projectNameError = validateProjectName(record.project_name);
    if (projectNameError) {
        errors.project_name = projectNameError;
    }
    
    const emailError = validateEmail(record.uploader_email);
    if (emailError) {
        errors.uploader_email = emailError;
    }
    
    const timeError = validateUploadTime(record.upload_time);
    if (timeError) {
        errors.upload_time = timeError;
    }
    
    const formatError = validateContentFormat(record.content_format);
    if (formatError) {
        // 内容格式错误通常不会单独显示，但可以记录
    }
    
    const contentError = validateContentSize(record.content);
    if (contentError) {
        errors.content = contentError;
    }
    
    return errors;
}

/**
 * 验证上传表单数据
 * @param formData 上传表单数据
 * @returns 验证错误对象，如果有效则返回空对象
 */
export function validateUploadFormData(formData: UploadFormData): ValidationErrors {
    // 转换为 UploadRecord 进行验证
    const record: UploadRecord = {
        title: formData.title,
        project_name: formData.project_name,
        uploader_email: formData.uploader_email,
        upload_time: formData.upload_time,
        content_format: formData.content_format,
        content: formData.content
    };
    
    return validateUploadRecord(record);
}

/**
 * 自动填充数据接口
 * 用于在Extension Host和Webview之间传递自动填充信息
 */
export interface AutoFillData {
    /**
     * 用户邮箱地址
     * - 从JWT token中提取
     * - 如果token不存在或解析失败，则为null
     */
    email: string | null;
    
    /**
     * 项目名称
     * - 从当前工作区获取
     * - 如果没有打开工作区，则为null
     */
    projectName: string | null;
    
    /**
     * 会话标题
     * - 从数据库中的会话记录获取
     * - 如果没有会话记录或无法获取，则为null
     */
    title: string | null;
}