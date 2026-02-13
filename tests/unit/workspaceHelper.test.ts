import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { WorkspaceHelper } from '../../src/utils/workspaceHelper';

// Mock vscode module
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: undefined
    }
}));

describe('WorkspaceHelper', () => {
    beforeEach(() => {
        // Reset workspace folders before each test
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    describe('getCurrentWorkspaceName', () => {
        it('应返回第一个工作区文件夹的名称', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [
                {
                    name: 'test-workspace',
                    uri: { fsPath: '/path/to/test-workspace' }
                }
            ];

            // Act
            const result = WorkspaceHelper.getCurrentWorkspaceName();

            // Assert
            expect(result).toBe('test-workspace');
        });

        it('当没有工作区时应返回null', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = undefined;

            // Act
            const result = WorkspaceHelper.getCurrentWorkspaceName();

            // Assert
            expect(result).toBeNull();
        });

        it('当工作区数组为空时应返回null', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [];

            // Act
            const result = WorkspaceHelper.getCurrentWorkspaceName();

            // Assert
            expect(result).toBeNull();
        });

        it('当有多个工作区时应返回第一个', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [
                { name: 'workspace-1', uri: { fsPath: '/path/to/workspace-1' } },
                { name: 'workspace-2', uri: { fsPath: '/path/to/workspace-2' } }
            ];

            // Act
            const result = WorkspaceHelper.getCurrentWorkspaceName();

            // Assert
            expect(result).toBe('workspace-1');
        });
    });

    describe('getCurrentWorkspacePath', () => {
        it('应返回第一个工作区文件夹的路径', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [
                {
                    name: 'test-workspace',
                    uri: { fsPath: '/path/to/test-workspace' }
                }
            ];

            // Act
            const result = WorkspaceHelper.getCurrentWorkspacePath();

            // Assert
            expect(result).toBe('/path/to/test-workspace');
        });

        it('当没有工作区时应返回null', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = undefined;

            // Act
            const result = WorkspaceHelper.getCurrentWorkspacePath();

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getAllWorkspaceNames', () => {
        it('应返回所有工作区文件夹的名称', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [
                { name: 'workspace-1', uri: { fsPath: '/path/to/workspace-1' } },
                { name: 'workspace-2', uri: { fsPath: '/path/to/workspace-2' } },
                { name: 'workspace-3', uri: { fsPath: '/path/to/workspace-3' } }
            ];

            // Act
            const result = WorkspaceHelper.getAllWorkspaceNames();

            // Assert
            expect(result).toEqual(['workspace-1', 'workspace-2', 'workspace-3']);
        });

        it('当没有工作区时应返回空数组', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = undefined;

            // Act
            const result = WorkspaceHelper.getAllWorkspaceNames();

            // Assert
            expect(result).toEqual([]);
        });

        it('当工作区数组为空时应返回空数组', () => {
            // Arrange
            (vscode.workspace as any).workspaceFolders = [];

            // Act
            const result = WorkspaceHelper.getAllWorkspaceNames();

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('getSystemUsername', () => {
        it('应返回非空字符串', () => {
            const username = WorkspaceHelper.getSystemUsername();
            expect(username).toBeTruthy();
            expect(username.length).toBeGreaterThan(0);
        });

        it('应返回合理的用户名格式', () => {
            const username = WorkspaceHelper.getSystemUsername();
            expect(username).not.toBe('');
            expect(typeof username).toBe('string');
            // 用户名不应该包含明显非法字符
            expect(username).not.toContain('\n');
            expect(username).not.toContain('\r');
        });

        it('应与 os.userInfo().username 一致', () => {
            const os = require('os');
            const expected = os.userInfo().username;
            const username = WorkspaceHelper.getSystemUsername();
            expect(username).toBe(expected);
        });

        it('不应返回"本地用户"硬编码值（当系统有用户名时）', () => {
            const username = WorkspaceHelper.getSystemUsername();
            // 在正常系统环境下，不应回退到硬编码值
            expect(username).not.toBe('本地用户');
        });
    });
});
