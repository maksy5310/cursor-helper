/**
 * 文本清理工具
 * 用于清理字符串中的非法字符，确保可以被 UTF-8 正确编码
 */

/**
 * 清理字符串中的孤立代理字符（surrogate characters）
 * 
 * 在 JavaScript 中，某些 emoji 和特殊字符会被表示为代理对（surrogate pairs）。
 * 如果字符串处理不当，可能产生孤立的代理字符，这些字符无法被 Python 的 UTF-8 编码器处理。
 * 
 * 孤立代理字符的范围：
 * - 高位代理（High Surrogate）: U+D800 到 U+DBFF
 * - 低位代理（Low Surrogate）: U+DC00 到 U+DFFF
 * 
 * @param text 需要清理的文本
 * @param replacement 替换字符，默认为 '�' (U+FFFD 替换字符)
 * @returns 清理后的文本
 * 
 * @example
 * ```typescript
 * const text = "Hello\uD83DWorld"; // 包含孤立的高位代理
 * const cleaned = sanitizeSurrogates(text); // "Hello�World"
 * ```
 */
export function sanitizeSurrogates(text: string, replacement: string = '\uFFFD'): string {
    // 正则表达式说明：
    // [\uD800-\uDBFF](?![\uDC00-\uDFFF]) - 匹配孤立的高位代理（后面没有跟低位代理）
    // (?<![\uD800-\uDBFF])[\uDC00-\uDFFF] - 匹配孤立的低位代理（前面没有高位代理）
    const orphanedSurrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
    
    return text.replace(orphanedSurrogatePattern, replacement);
}

/**
 * 检测字符串是否包含孤立的代理字符
 * 
 * @param text 需要检测的文本
 * @returns true 如果包含孤立代理字符，否则返回 false
 */
export function hasSurrogates(text: string): boolean {
    const orphanedSurrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
    return orphanedSurrogatePattern.test(text);
}

/**
 * 验证字符串是否可以安全地进行 UTF-8 编码
 * 
 * @param text 需要验证的文本
 * @returns true 如果可以安全编码，否则返回 false
 */
export function isValidUTF8(text: string): boolean {
    try {
        // 尝试使用 TextEncoder 编码
        // 如果包含孤立代理字符，TextEncoder 会抛出错误或替换为 �
        const encoder = new TextEncoder();
        encoder.encode(text);
        
        // 另外检查是否包含孤立代理
        return !hasSurrogates(text);
    } catch (error) {
        return false;
    }
}

/**
 * 全面清理文本，确保可以安全地发送到服务器
 * 
 * 包括：
 * - 清理孤立的代理字符
 * - 移除其他非法字符（可选）
 * 
 * @param text 需要清理的文本
 * @param options 清理选项
 * @returns 清理后的文本
 */
export function sanitizeForUpload(
    text: string, 
    options: {
        replacement?: string;
        removeNullBytes?: boolean;
    } = {}
): string {
    let cleaned = text;
    
    // 1. 清理孤立的代理字符
    cleaned = sanitizeSurrogates(cleaned, options.replacement);
    
    // 2. 可选：移除 NULL 字节（\0）
    if (options.removeNullBytes !== false) {
        cleaned = cleaned.replace(/\0/g, '');
    }
    
    return cleaned;
}

/**
 * 获取清理报告
 * 
 * @param original 原始文本
 * @param cleaned 清理后的文本
 * @returns 清理报告
 */
export function getSanitizationReport(original: string, cleaned: string): {
    hasSurrogates: boolean;
    surrogateCount: number;
    lengthChanged: boolean;
    originalLength: number;
    cleanedLength: number;
} {
    const surrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
    const surrogates = original.match(surrogatePattern) || [];
    
    return {
        hasSurrogates: surrogates.length > 0,
        surrogateCount: surrogates.length,
        lengthChanged: original.length !== cleaned.length,
        originalLength: original.length,
        cleanedLength: cleaned.length
    };
}
