/**
 * 认证相关类型定义 (Simple JWT Authentication)
 */

/**
 * 认证状态
 */
export interface AuthState {
    /**
     * 是否已登录
     */
    isAuthenticated: boolean;

    /**
     * JWT token(存储在SecretStorage,此处为内存缓存)
     */
    token: string | null;

    /**
     * Token过期时间戳(从JWT解析,可选)
     */
    tokenExpiry: number | null;
}

/**
 * 登录响应
 */
export interface LoginResponse {
    /**
     * JWT token
     */
    token: string;

    /**
     * 用户信息(可选)
     */
    user?: {
        id: string;
        username: string;
        email: string;
    };
}

/**
 * Token信息
 */
export interface TokenInfo {
    /**
     * JWT token字符串
     */
    token: string;

    /**
     * 存储时间戳(用于调试和日志)
     */
    storedAt: number;
}

/**
 * 登录回调数据
 */
export interface LoginCallback {
    /**
     * JWT token
     */
    token: string;

    /**
     * 来源标识
     */
    source: 'callback';
}

/**
 * JWT Payload结构 (spec-share-server)
 * 根据后端实际返回的JWT payload定义
 */
export interface JWTPayload {
    /** 用户邮箱 */
    email: string;
    
    /** 用户角色 */
    role: string;
    
    /** 用户名 */
    username?: string;
    
    /** 头像URL */
    avatar_url?: string;
    
    /** 过期时间(秒, Unix timestamp) */
    exp: number;
    
    /** 签发时间(秒, Unix timestamp) */
    iat: number;
    
    /** 签发者(可选) */
    iss?: string;
}

/**
 * JWT Token类型(简化版)
 * 仅包含访问令牌,不支持refresh token
 */
export type JWTToken = string;
