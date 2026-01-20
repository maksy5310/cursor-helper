import { TokenManager } from './tokenManager';
import { Logger } from './logger';

/**
 * API 客户端工具类
 * 封装 HTTP 请求，提供超时处理、错误处理和自动令牌刷新
 */

/**
 * HTTP 请求选项
 */
export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number; // 超时时间（毫秒），默认 30 秒
}

/**
 * HTTP 响应
 */
export interface HttpResponse<T = any> {
    ok: boolean;
    status: number;
    statusText: string;
    data: T;
    headers: Headers;
}

/**
 * HTTP 错误
 */
export class HttpError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public response?: any
    ) {
        super(`HTTP ${status}: ${statusText}`);
        this.name = 'HttpError';
    }
}

/**
 * 超时错误
 */
export class TimeoutError extends Error {
    constructor(timeout: number) {
        super(`Request timeout after ${timeout}ms`);
        this.name = 'TimeoutError';
    }
}

/**
 * API 客户端类
 */
export class ApiClient {
    private readonly defaultTimeout = 30000; // 30 秒
    private tokenManager: TokenManager | null = null;

    /**
     * 设置TokenManager以支持自动令牌刷新
     */
    setTokenManager(tokenManager: TokenManager): void {
        this.tokenManager = tokenManager;
    }

    /**
     * 发送 HTTP 请求(带401拦截和自动令牌刷新)
     * @param url 请求 URL
     * @param options 请求选项
     * @param skipAuth 跳过认证(用于登录等公开端点)
     * @param retryOn401 是否在401时重试(默认true)
     * @returns 响应数据
     * @throws HttpError 或 TimeoutError
     */
    async request<T = any>(url: string, options: RequestOptions = {}, skipAuth: boolean = false, retryOn401: boolean = true): Promise<HttpResponse<T>> {
        // 1. 获取有效令牌(如果需要认证)
        let headers = { ...options.headers };
        if (!skipAuth && this.tokenManager) {
            const token = await this.tokenManager.getValidToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const timeout = options.timeout || this.defaultTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // 2. 发起请求
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let data: T;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json() as T;
            } else {
                data = await response.text() as T;
            }

            // 3. 401拦截器:JWT过期,清除令牌并提示重新登录
            if (response.status === 401 && retryOn401 && this.tokenManager) {
                Logger.warn('Received 401 Unauthorized, token may be expired');
                // 清除过期的token
                await this.tokenManager.clearToken();
                // 抛出401错误,由调用方处理
                throw new HttpError(response.status, 'Unauthorized - Please login again', data);
            }

            if (!response.ok) {
                throw new HttpError(response.status, response.statusText, data);
            }

            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                data,
                headers: response.headers
            };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof HttpError) {
                throw error;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                throw new TimeoutError(timeout);
            }

            // 网络错误或其他错误
            throw new Error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * GET 请求
     */
    async get<T = any>(url: string, headers?: Record<string, string>, timeout?: number): Promise<HttpResponse<T>> {
        return this.request<T>(url, { method: 'GET', headers, timeout });
    }

    /**
     * POST 请求
     */
    async post<T = any>(url: string, body: any, headers?: Record<string, string>, timeout?: number): Promise<HttpResponse<T>> {
        const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        return this.request<T>(url, { method: 'POST', headers: requestHeaders, body: jsonBody, timeout });
    }

    /**
     * PUT 请求
     */
    async put<T = any>(url: string, body: any, headers?: Record<string, string>, timeout?: number): Promise<HttpResponse<T>> {
        const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        return this.request<T>(url, { method: 'PUT', headers: requestHeaders, body: jsonBody, timeout });
    }

    /**
     * DELETE 请求
     */
    async delete<T = any>(url: string, headers?: Record<string, string>, timeout?: number): Promise<HttpResponse<T>> {
        return this.request<T>(url, { method: 'DELETE', headers, timeout });
    }
}

