import { JWTPayload } from '../models/auth';
import { Logger } from './logger';

/**
 * JWT解析工具
 * 提供JWT令牌的解析、验证和用户信息提取功能
 */
export class JWTParser {
    /**
     * 解析JWT payload
     * @param token JWT令牌字符串
     * @returns 解析后的payload对象,如果解析失败则返回null
     */
    static parsePayload(token: string): JWTPayload | null {
        try {
            // JWT格式: header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                Logger.error('Invalid JWT format: expected 3 parts', new Error(`Got ${parts.length} parts`));
                return null;
            }

            // Base64 URL解码payload部分
            const payload = parts[1];
            const decoded = Buffer.from(payload, 'base64').toString('utf8');
            const parsedPayload = JSON.parse(decoded) as JWTPayload;

            // 基本验证:必须包含email和exp
            if (!parsedPayload.email || !parsedPayload.exp) {
                Logger.error('Invalid JWT payload: missing required fields', new Error('email or exp not found'));
                return null;
            }

            return parsedPayload;
        } catch (error) {
            Logger.error('Failed to parse JWT payload', error as Error);
            return null;
        }
    }

    /**
     * 获取JWT过期时间戳(毫秒)
     * @param token JWT令牌字符串
     * @returns 过期时间戳(毫秒),如果解析失败则返回0
     */
    static getExpiryTimestamp(token: string): number {
        const payload = this.parsePayload(token);
        if (!payload) {
            return 0;
        }
        // JWT的exp是秒级Unix timestamp,转换为毫秒
        return payload.exp * 1000;
    }

    /**
     * 检查JWT是否已过期
     * @param token JWT令牌字符串
     * @returns 如果已过期返回true,否则返回false
     */
    static isExpired(token: string): boolean {
        const expiryTime = this.getExpiryTimestamp(token);
        if (expiryTime === 0) {
            // 无法解析,视为过期
            return true;
        }
        return Date.now() >= expiryTime;
    }

    /**
     * 检查JWT是否即将过期(默认5分钟)
     * @param token JWT令牌字符串
     * @param thresholdMs 提前预警时间(毫秒),默认5分钟
     * @returns 如果即将过期返回true,否则返回false
     */
    static isAboutToExpire(token: string, thresholdMs: number = 5 * 60 * 1000): boolean {
        const expiryTime = this.getExpiryTimestamp(token);
        if (expiryTime === 0) {
            return true;
        }
        return Date.now() >= (expiryTime - thresholdMs);
    }

    /**
     * 从JWT中提取用户邮箱
     * @param token JWT令牌字符串
     * @returns 用户邮箱,如果解析失败则返回null
     */
    static getUserEmail(token: string): string | null {
        const payload = this.parsePayload(token);
        return payload?.email || null;
    }

    /**
     * 从JWT中提取用户角色
     * @param token JWT令牌字符串
     * @returns 用户角色,如果解析失败则返回null
     */
    static getUserRole(token: string): string | null {
        const payload = this.parsePayload(token);
        return payload?.role || null;
    }

    /**
     * 验证JWT格式是否有效
     * @param token JWT令牌字符串
     * @returns 如果格式有效返回true,否则返回false
     */
    static isValidFormat(token: string): boolean {
        if (!token || typeof token !== 'string') {
            return false;
        }
        const parts = token.split('.');
        return parts.length === 3 && parts.every(part => part.length > 0);
    }

    /**
     * 获取JWT签发时间戳(毫秒)
     * @param token JWT令牌字符串
     * @returns 签发时间戳(毫秒),如果解析失败则返回0
     */
    static getIssuedAtTimestamp(token: string): number {
        const payload = this.parsePayload(token);
        if (!payload || !payload.iat) {
            return 0;
        }
        // JWT的iat是秒级Unix timestamp,转换为毫秒
        return payload.iat * 1000;
    }

    /**
     * 获取JWT剩余有效时间(毫秒)
     * @param token JWT令牌字符串
     * @returns 剩余有效时间(毫秒),如果已过期或解析失败则返回0
     */
    static getRemainingTime(token: string): number {
        const expiryTime = this.getExpiryTimestamp(token);
        if (expiryTime === 0) {
            return 0;
        }
        const remaining = expiryTime - Date.now();
        return remaining > 0 ? remaining : 0;
    }
}
