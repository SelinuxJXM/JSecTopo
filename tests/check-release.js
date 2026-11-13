/* ============================================================
 * 发布前自检：敏感信息 / 导出物 / 仓库基础文件
 * 用法：node tests/check-release.js  或  npm run check:release
 * 零依赖，只用 Node 内置模块；发现问题会以非零退出码结束。
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set(['.git', '.workbuddy', 'node_modules', 'exports']);
const REQUIRED = [
  'README.md', 'LICENSE', '.gitignore', 'package.json',
  '.github/workflows/test.yml', 'index.html', 'tests/verify.js'
];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (SKIP_DIRS.has(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  });
  return out;
}

const problems = [];
const files = walk(ROOT, []);

REQUIRED.forEach(function (f) {
  if (!fs.existsSync(path.join(ROOT, f))) problems.push('缺少基础文件：' + f);
});

/* 敏感词用拼接构造，避免本脚本自身被误报 */
const SENSITIVE = ['张' + '工', '测评' + '中心', '景' + '鑫' + '淼'];
const LOCAL_PATH = new RegExp('C:' + String.fromCharCode(92) + 'Users|C:' + String.fromCharCode(47) + 'Users');

/* 允许：RFC1918 私有段、回环、RFC5737 文档专用段、广播/未指定地址 */
function allowedIp(ip) {
  const a = ip.split('.').map(Number);
  if (a.some(function (x) { return x > 255; })) return false;
  return a[0] === 10 ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) ||
    a[0] === 127 ||
    (a[0] === 192 && a[1] === 0 && a[2] === 2) ||
    (a[0] === 198 && a[1] === 51 && a[2] === 100) ||
    (a[0] === 203 && a[1] === 0 && a[2] === 113) ||
    ip === '0.0.0.0' || ip === '255.255.255.255';
}
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const EXPORT_RE = /^资产清单_|^整改前后差异_|_报告版式\.(png|svg)$/;

files.forEach(function (f) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  let t;
  try { t = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
  if (LOCAL_PATH.test(t)) problems.push(rel + '：含本地绝对路径');
  SENSITIVE.forEach(function (s) {
    if (t.indexOf(s) >= 0) problems.push(rel + '：含疑似个人信息「' + s + '」');
  });
  const pub = [];
  let m;
  IP_RE.lastIndex = 0;
  while ((m = IP_RE.exec(t)) !== null) {
    if (!allowedIp(m[0]) && pub.indexOf(m[0]) < 0) pub.push(m[0]);
  }
  if (pub.length) problems.push(rel + '：含非文档/非私有 IP ' + pub.slice(0, 5).join(', '));
  if (EXPORT_RE.test(path.basename(f))) problems.push(rel + '：疑似导出物，不应提交');
});

/* .gitignore 关键规则 */
const ignPath = path.join(ROOT, '.gitignore');
if (fs.existsSync(ignPath)) {
  const ign = fs.readFileSync(ignPath, 'utf8');
  ['.workbuddy/', '/*.json', '!/package.json', 'exports/'].forEach(function (k) {
    if (ign.indexOf(k) < 0) problems.push('.gitignore 缺少规则：' + k);
  });
}

console.log('发布前自检');
console.log('  扫描文件：' + files.length + ' 个');
console.log('  基础文件：' + REQUIRED.length + ' 项');
if (problems.length) {
  console.log('  发现 ' + problems.length + ' 项风险：');
  problems.forEach(function (p) { console.log('   - ' + p); });
  process.exitCode = 1;
} else {
  console.log('  通过：未发现敏感信息、导出物，基础文件齐备');
}
