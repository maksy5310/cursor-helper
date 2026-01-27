/**
 * 文本清理工具测试
 */

import { 
    sanitizeSurrogates, 
    hasSurrogates, 
    isValidUTF8, 
    sanitizeForUpload,
    getSanitizationReport 
} from '../src/utils/textSanitizer';

/**
 * 运行所有测试
 */
export function runTextSanitizerTests(): void {
    console.log('========================================');
    console.log('文本清理工具测试');
    console.log('========================================\n');

    // 测试1: 正常文本（不包含代理字符）
    console.log('测试1: 正常文本');
    const normalText = 'Hello, World! 你好，世界！';
    console.log(`  输入: "${normalText}"`);
    console.log(`  包含代理字符: ${hasSurrogates(normalText)}`);
    console.log(`  有效 UTF-8: ${isValidUTF8(normalText)}`);
    console.log(`  清理后: "${sanitizeSurrogates(normalText)}"`);
    console.log();

    // 测试2: 正常的 emoji（完整的代理对）
    console.log('测试2: 正常的 emoji');
    const emojiText = 'Hello 😀 World 🎉';
    console.log(`  输入: "${emojiText}"`);
    console.log(`  包含代理字符: ${hasSurrogates(emojiText)}`);
    console.log(`  有效 UTF-8: ${isValidUTF8(emojiText)}`);
    console.log(`  清理后: "${sanitizeSurrogates(emojiText)}"`);
    console.log();

    // 测试3: 孤立的高位代理
    console.log('测试3: 孤立的高位代理（U+D83D 不跟随低位代理）');
    const orphanedHighSurrogate = 'Hello\uD83DWorld';
    console.log(`  输入: "Hello\\uD83DWorld"`);
    console.log(`  包含代理字符: ${hasSurrogates(orphanedHighSurrogate)}`);
    console.log(`  有效 UTF-8: ${isValidUTF8(orphanedHighSurrogate)}`);
    console.log(`  清理后: "${sanitizeSurrogates(orphanedHighSurrogate)}"`);
    console.log(`  清理后（显示替换字符）: "${sanitizeSurrogates(orphanedHighSurrogate).replace(/\uFFFD/g, '[REPLACED]')}"`);
    console.log();

    // 测试4: 孤立的低位代理
    console.log('测试4: 孤立的低位代理（U+DE00 没有前面的高位代理）');
    const orphanedLowSurrogate = 'Hello\uDE00World';
    console.log(`  输入: "Hello\\uDE00World"`);
    console.log(`  包含代理字符: ${hasSurrogates(orphanedLowSurrogate)}`);
    console.log(`  有效 UTF-8: ${isValidUTF8(orphanedLowSurrogate)}`);
    console.log(`  清理后: "${sanitizeSurrogates(orphanedLowSurrogate)}"`);
    console.log(`  清理后（显示替换字符）: "${sanitizeSurrogates(orphanedLowSurrogate).replace(/\uFFFD/g, '[REPLACED]')}"`);
    console.log();

    // 测试5: 混合文本（包含正常 emoji 和孤立代理）
    console.log('测试5: 混合文本');
    const mixedText = 'Hello 😀 \uD83D World \uDE00 🎉';
    console.log(`  输入: "Hello 😀 \\uD83D World \\uDE00 🎉"`);
    console.log(`  包含代理字符: ${hasSurrogates(mixedText)}`);
    console.log(`  有效 UTF-8: ${isValidUTF8(mixedText)}`);
    console.log(`  清理后: "${sanitizeSurrogates(mixedText)}"`);
    console.log(`  清理后（显示替换字符）: "${sanitizeSurrogates(mixedText).replace(/\uFFFD/g, '[REPLACED]')}"`);
    console.log();

    // 测试6: sanitizeForUpload 完整功能
    console.log('测试6: sanitizeForUpload 完整清理');
    const complexText = 'Hello\uD83D\0World\uDE00';
    console.log(`  输入: "Hello\\uD83D\\0World\\uDE00" (包含孤立代理和 NULL 字节)`);
    const cleaned = sanitizeForUpload(complexText);
    console.log(`  清理后: "${cleaned}"`);
    console.log(`  清理后（显示替换字符）: "${cleaned.replace(/\uFFFD/g, '[REPLACED]')}"`);
    const report = getSanitizationReport(complexText, cleaned);
    console.log(`  清理报告:`, report);
    console.log();

    // 测试7: 自定义替换字符
    console.log('测试7: 自定义替换字符');
    const customReplacement = sanitizeSurrogates('Hello\uD83DWorld', '[?]');
    console.log(`  输入: "Hello\\uD83DWorld"`);
    console.log(`  替换字符: "[?]"`);
    console.log(`  清理后: "${customReplacement}"`);
    console.log();

    // 测试8: 模拟真实场景 - 大量文本中的孤立代理
    console.log('测试8: 真实场景模拟');
    const realWorldText = `
# Agent 使用记录

这是一个包含 emoji 的文档 😀

但是在某些情况下，字符串处理可能导致孤立的代理字符：
- 第一个问题: Hello\uD83DWorld
- 第二个问题: Test\uDE00Example

正常的 emoji 应该保留: 🎉 ✨ 🚀
`;
    console.log(`  输入文本长度: ${realWorldText.length} 字符`);
    console.log(`  包含孤立代理: ${hasSurrogates(realWorldText)}`);
    const cleanedReal = sanitizeForUpload(realWorldText);
    const realReport = getSanitizationReport(realWorldText, cleanedReal);
    console.log(`  清理报告:`, realReport);
    console.log(`  清理后文本（前200字符）:`, cleanedReal.substring(0, 200));
    console.log();

    console.log('========================================');
    console.log('测试完成！');
    console.log('========================================');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runTextSanitizerTests();
}
