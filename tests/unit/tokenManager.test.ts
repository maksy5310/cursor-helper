import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue('')
        })
    },
    window: {
        createOutputChannel: vi.fn().mockReturnValue({
            appendLine: vi.fn(),
            show: vi.fn(),
            dispose: vi.fn()
        })
    }
}));

import { TokenManager } from '../../src/utils/tokenManager';

// Mock vscode context
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

    describe('isValidTokenFormat', () => {
        it('应验证有效的JWT格式', () => {
            expect(tokenManager.isValidTokenFormat('header.payload.signature')).toBe(true);
        });

        it('应拒绝只有两个部分的token', () => {
            expect(tokenManager.isValidTokenFormat('header.payload')).toBe(false);
        });

        it('应拒绝只有一个部分的token', () => {
            expect(tokenManager.isValidTokenFormat('onlyheader')).toBe(false);
        });

        it('应拒绝空字符串', () => {
            expect(tokenManager.isValidTokenFormat('')).toBe(false);
        });

        it('应拒绝null值', () => {
            expect(tokenManager.isValidTokenFormat(null as any)).toBe(false);
        });

        it('应拒绝undefined值', () => {
            expect(tokenManager.isValidTokenFormat(undefined as any)).toBe(false);
        });
    });

    describe('getUserEmail', () => {
        it('当token不存在时应返回null', async () => {
            mockSecrets.get.mockResolvedValue(null);
            const result = await tokenManager.getUserEmail();
            expect(result).toBeNull();
        });

        it('当token格式无效时应返回null', async () => {
            mockSecrets.get.mockResolvedValue('invalid.token');
            const result = await tokenManager.getUserEmail();
            expect(result).toBeNull();
        });
    });
});
