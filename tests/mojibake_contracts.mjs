import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = [
  "scripts",
  "tests",
  "electron",
  "unity-prototype/Assets/Scripts",
  "unity-prototype/Assets/StreamingAssets",
  "index.html",
  "styles.css",
];
const textExtensions = new Set([".js", ".mjs", ".cjs", ".html", ".css", ".cs", ".json"]);
const ignoredPathParts = new Set(["Library", "Temp", "Logs", "obj", "UserSettings"]);

// Common UTF-8/GBK mojibake fragments seen in previous UI strings.
// Stored as code points so this test does not depend on the shell code page.
const mojibakeCodePoints = new Set([
  0xfffd, // replacement character
  0x93c6, // 鏆
  0x6d63, // 浣
  0x72b3, // 犳
  0x8930, // 褰
  0x69c5, // 槅
  0x9359, // frequent bridge mojibake
  0x7035, // 瀵
  0x9416, // 鐖
  0x9397, // frequent bridge mojibake
  0x95c3, // 闃
  0x7d3e, // frequent bridge mojibake
  0x5a34, // 娴
  0x714e, // 煎
  0x93b4, // 鎴
  0x6f36, // frequent bridge mojibake
  0x5a2c, // frequent bridge mojibake
  0x947d, // 鑽
  0x60e7, // 惧
  0x64b3, // 撳
]);

function shouldSkip(filePath) {
  return filePath
    .split(path.sep)
    .some((part) => ignoredPathParts.has(part));
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function isSuspiciousLine(line) {
  if (/\?{4,}/.test(line)) return true;
  let score = 0;
  for (const char of line) {
    const codePoint = char.codePointAt(0);
    if (codePoint >= 0xe000 && codePoint <= 0xf8ff) return true;
    if (mojibakeCodePoints.has(codePoint)) score += 1;
  }
  return score >= 2;
}

function walk(entryPath, hits) {
  if (!fs.existsSync(entryPath) || shouldSkip(entryPath)) return;
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, child), hits);
    }
    return;
  }
  if (!isTextFile(entryPath)) return;
  const text = fs.readFileSync(entryPath, "utf8").replace(/^\uFEFF/, "");
  text.split(/\r?\n/).forEach((line, index) => {
    if (isSuspiciousLine(line)) {
      hits.push(`${path.relative(root, entryPath)}:${index + 1}: ${line.slice(0, 160)}`);
    }
  });
}

const hits = [];
for (const target of targets) {
  walk(path.resolve(root, target), hits);
}

assert.deepEqual(hits, []);
console.log("mojibake contracts ok");
