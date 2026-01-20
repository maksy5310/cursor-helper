import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenManager } from '../../src/utils/tokenManager';
import * as vscode from 'vscode';

// Mock vscode module
const mockSecrets = {
    store: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
};

const mockContext = {
    secrets: mockSecrets
} as any;

describe('TokenManager', () => {
    let tokenManager: TokenManager;

    beforeEach(() => {
        tokenManager = new TokenManager(mockContext);
        vi.clearAllMocks();
    });

    describe('getUserEmail', () => {
        it('应从有效token中提取邮箱', async () => {
            // Arrange
            const payload = { email: 'test@example.com' };
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const token = `header.${encodedPayload}.signature`;
            mockSecrets.get.mockResolvedValue(token);

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBe('test@example.com');
        });

        it('应从嵌套user对象中提取邮箱', async () => {
            // Arrange
            const payload = { user: { email: 'nested@example.com' } };
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const token = `header.${encodedPayload}.signature`;
            mockSecrets.get.mockResolvedValue(token);

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBe('nested@example.com');
        });

        it('当token不存在时应返回null', async () => {
            // Arrange
            mockSecrets.get.mockResolvedValue(null);

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBeNull();
        });

        it('当token格式无效时应返回null', async () => {
            // Arrange
            mockSecrets.get.mockResolvedValue('invalid.token');

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBeNull();
        });

        it('当payload无法解码时应返回null', async () => {
            // Arrange
            mockSecrets.get.mockResolvedValue('header.invalid-base64.signature');

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBeNull();
        });

        it('当payload中没有邮箱字段时应返回null', async () => {
            // Arrange
            const payload = { name: 'Test User' };
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const token = `header.${encodedPayload}.signature`;
            mockSecrets.get.mockResolvedValue(token);

            // Act
            const result = await tokenManager.getUserEmail();

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('isValidToken', () => {
        it('应验证有效的JWT格式', () => {
            // Act & Assert
            expect(tokenManager.isValidToken('header.payload.signature')).toBe(true);
        });

        it('应拒绝只有两个部分的token', () => {
            // Act & Assert
            expect(tokenManager.isValidToken('header.payload')).toBe(false);
        });

        it('应拒绝只有一个部分的token', () => {
            // Act & Assert
            expect(tokenManager.isValidToken('onlyheader')).toBe(false);
        });

        it('应拒绝空字符串', () => {
            // Act & Assert
            expect(tokenManager.isValidToken('')).toBe(false);
        });

        it('应拒绝null值', () => {
            // Act & Assert
            expect(tokenManager.isValidToken(null as any)).toBe(false);
        });

        it('应拒绝undefined值', () => {
            // Act & Assert
            expect(tokenManager.isValidToken(undefined as any)).toBe(false);
        });

        it('应拒绝包含空部分的token', () => {
            // Act & Assert
            expect(tokenManager.isValidToken('header..signature')).toBe(false);
        });
    });
});
