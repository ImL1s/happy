/**
 * 測試腳本：驗證 session 同步問題
 *
 * 問題描述：
 * 當資料夾名稱包含下劃線（如 test_temp_01）時，
 * 本地模式和遠端模式之間的 session 同步會失敗。
 */

import { normalizePathForKey } from '../utils/normalizePathForKey';

// 測試路徑
const testPaths = [
    '/Users/iml1s/Documents/test_temp_01',
    '/Users/iml1s/Documents/test.temp.01',
    '/Users/iml1s/Documents/test-temp-01',
    '/Users/iml1s/Documents/testtemp01',
    '~/Documents/test_temp_01',
];

console.log('=== normalizePathForKey 測試 ===\n');

for (const path of testPaths) {
    const normalized = normalizePathForKey(path);
    console.log(`原始路徑: ${path}`);
    console.log(`正規化後: ${normalized}`);
    console.log('---');
}

// 模擬 project key 生成
const machineId = 'machine-123';

console.log('\n=== Project Key 生成測試 ===\n');

for (const path of testPaths) {
    const projectKey = `${machineId}:${normalizePathForKey(path)}`;
    console.log(`路徑: ${path}`);
    console.log(`Project Key: ${projectKey}`);
    console.log('---');
}

// 驗證不同格式的路徑是否會產生相同的 key
console.log('\n=== 碰撞測試 ===\n');

const path1 = '/Users/iml1s/Documents/test_temp_01';
const path2 = '/Users/iml1s/Documents/test.temp.01';
const path3 = '/Users/iml1s/Documents/test-temp-01';

const key1 = normalizePathForKey(path1);
const key2 = normalizePathForKey(path2);
const key3 = normalizePathForKey(path3);

console.log(`path1 (下劃線): ${path1}`);
console.log(`path2 (點):     ${path2}`);
console.log(`path3 (連字符): ${path3}`);
console.log('');
console.log(`key1: ${key1}`);
console.log(`key2: ${key2}`);
console.log(`key3: ${key3}`);
console.log('');
console.log(`key1 === key2: ${key1 === key2}`);
console.log(`key2 === key3: ${key2 === key3}`);
console.log(`key1 === key3: ${key1 === key3}`);

// 這是預期的行為：不同格式的路徑會產生相同的 key
// 這樣才能匹配 Claude Code 的 .claude/projects 命名慣例

console.log('\n=== 測試完成 ===');
