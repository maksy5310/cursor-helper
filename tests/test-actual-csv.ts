/**
 * 测试实际 CSV 文件的第一行
 */

import * as fs from 'fs';
import * as path from 'path';

const csvPath = path.join(__dirname, 'p1sc-conversation.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

console.log(`总行数: ${lines.length}`);
console.log(`\n第一行长度: ${lines[0].length}`);
console.log(`第一行前200字符:`);
console.log(lines[0].substring(0, 200));

// 测试解析
const line = lines[0];
const firstCommaIndex = line.indexOf(',');

if (firstCommaIndex === -1) {
    console.log('\n❌ 没有找到逗号分隔符');
    process.exit(1);
}

const bubbleIdPart = line.substring(0, firstCommaIndex);
let jsonPart = line.substring(firstCommaIndex + 1);

console.log(`\nBubbleId: ${bubbleIdPart}`);
console.log(`\nJSON 部分长度: ${jsonPart.length}`);
console.log(`JSON 开头: ${jsonPart.substring(0, 50)}`);
console.log(`JSON 结尾: ${jsonPart.substring(jsonPart.length - 50)}`);

// 移除外层引号
if (jsonPart.startsWith('"') && jsonPart.endsWith('"')) {
    jsonPart = jsonPart.substring(1, jsonPart.length - 1);
    console.log(`\n✅ 移除了外层引号`);
} else {
    console.log(`\n⚠️ 没有外层引号`);
    console.log(`开头字符: ${jsonPart.charCodeAt(0)} (${jsonPart[0]})`);
    console.log(`结尾字符: ${jsonPart.charCodeAt(jsonPart.length - 1)} (${jsonPart[jsonPart.length - 1]})`);
}

// 替换双引号
const beforeReplace = jsonPart.substring(0, 100);
jsonPart = jsonPart.replace(/""/g, '"');
const afterReplace = jsonPart.substring(0, 100);

console.log(`\n替换前: ${beforeReplace}`);
console.log(`替换后: ${afterReplace}`);

// 尝试解析
try {
    const data = JSON.parse(jsonPart);
    console.log(`\n✅ 解析成功!`);
    console.log(`数据类型: type=${data.type}, _v=${data._v}`);
} catch (error) {
    console.log(`\n❌ 解析失败:`);
    console.log(error);
    console.log(`\nJSON 前200字符:`);
    console.log(jsonPart.substring(0, 200));
}

