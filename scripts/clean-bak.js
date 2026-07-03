#!/usr/bin/env node
// 分批删除 .bak 文件脚本（默认每次删除 100 个）
// 使用：node scripts/clean-bak.js [batchSize]
const fs = require('fs');
const path = require('path');

async function walk(dir, acc = []) {
  const items = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) await walk(p, acc);
    else if (p.endsWith('.bak')) acc.push(p);
  }
  return acc;
}

async function main() {
  const root = path.join(process.cwd(), 'apps/frontend/src');
  const batchSize = Number(process.argv[2] || process.env.BATCH_SIZE || '100');
  const all = await walk(root);
  const toDelete = all.slice(0, batchSize);
  if (toDelete.length === 0) {
    console.log('No .bak files found');
    return;
  }
  for (const f of toDelete) {
    try { await fs.promises.unlink(f); console.log('Deleted', f); } catch {}
  }
  console.log(`Deleted ${toDelete.length} .bak files (batch size = ${batchSize}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });

