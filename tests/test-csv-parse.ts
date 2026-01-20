/**
 * 测试 CSV 解析逻辑
 */

// 模拟第一行数据
const testLine = `bubbleId:3e8719e2-58a8-41c6-9b19-402e9a3d7b4f:28d52b19-0cf0-487b-a2de-1de2a1c2e84d,"{""_v"":3,""type"":1,""text"":""hello world""}"`

console.log('原始行:');
console.log(testLine);
console.log('\n分隔符位置:', testLine.indexOf(','));

const firstCommaIndex = testLine.indexOf(',');
const bubbleIdPart = testLine.substring(0, firstCommaIndex);
let jsonPart = testLine.substring(firstCommaIndex + 1);

console.log('\nBubbleId:', bubbleIdPart);
console.log('\nJSON 部分（原始）:');
console.log(jsonPart);

// 移除开头和结尾的双引号
if (jsonPart.startsWith('"') && jsonPart.endsWith('"')) {
    jsonPart = jsonPart.substring(1, jsonPart.length - 1);
}

console.log('\n移除外层引号后:');
console.log(jsonPart);

// 替换 CSV 转义的双引号
jsonPart = jsonPart.replace(/""/g, '"');

console.log('\n替换双引号后:');
console.log(jsonPart);

try {
    const data = JSON.parse(jsonPart);
    console.log('\n✅ 解析成功!');
    console.log(JSON.stringify(data, null, 2));
} catch (error) {
    console.log('\n❌ 解析失败:');
    console.log(error);
}

