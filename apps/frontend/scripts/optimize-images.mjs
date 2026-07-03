#!/usr/bin/env node

/**
 * 图片优化脚本
 * 压缩Logo和Favicon，提升LCP性能
 *
 * 使用方法: node scripts/optimize-images.mjs
 */

import { readdir, stat, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const assetsDir = join(publicDir, 'assets/images');

const OPTIMIZATION_CONFIG = {
  png: {
    quality: 80,
    compressionLevel: 9,
    effort: 10,
  },
  jpeg: {
    quality: 85,
    progressive: true,
  },
  webp: {
    quality: 85,
    effort: 6,
  },
};

/**
 * 压缩单个图片
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    const input = sharp(inputPath);
    const metadata = await input.metadata();

    console.log(`  处理: ${inputPath}`);
    console.log(`    原始: ${metadata.width}x${metadata.height}, ${metadata.format}`);

    // 根据格式选择压缩配置
    let output = input;

    if (options.resize) {
      output = output.resize(options.resize.width, options.resize.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    switch (metadata.format) {
      case 'png':
        output = output.png(OPTIMIZATION_CONFIG.png);
        break;
      case 'jpeg':
      case 'jpg':
        output = output.jpeg(OPTIMIZATION_CONFIG.jpeg);
        break;
      case 'webp':
        output = output.webp(OPTIMIZATION_CONFIG.webp);
        break;
      default:
        console.log(`    ⚠️  跳过不支持的格式: ${metadata.format}`);
        return null;
    }

    // 确保输出目录存在
    await mkdir(dirname(outputPath), { recursive: true });

    // 保存优化后的图片
    await output.toFile(outputPath);

    // 获取文件大小
    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);
    const savedBytes = inputStats.size - outputStats.size;
    const savedPercent = ((savedBytes / inputStats.size) * 100).toFixed(1);

    console.log(`    优化后: ${(outputStats.size / 1024).toFixed(1)}KB (减少${savedPercent}%)`);

    return {
      input: inputPath,
      output: outputPath,
      originalSize: inputStats.size,
      optimizedSize: outputStats.size,
      saved: savedBytes,
      savedPercent: parseFloat(savedPercent),
    };
  } catch (error) {
    console.error(`  ❌ 优化失败: ${inputPath}`, error.message);
    return null;
  }
}

/**
 * 优化Favicon和Logo
 */
async function optimizeFavicons() {
  console.log('\n📸 开始优化Favicon和Logo...\n');

  const faviconDir = join(assetsDir, 'favicon');
  const results = [];

  // 优化配置: [输入文件, 输出文件, 选项]
  const tasks = [
    // Logo: 108KB → ~30KB
    {
      input: join(faviconDir, 'logo.png'),
      output: join(faviconDir, 'logo.png'),
      options: { resize: { width: 512, height: 512 } },
    },
    // Apple Touch Icon: 72KB → ~20KB
    {
      input: join(faviconDir, 'apple-touch-icon.png'),
      output: join(faviconDir, 'apple-touch-icon.png'),
      options: { resize: { width: 180, height: 180 } },
    },
    // Android Chrome 512: 56KB → ~15KB
    {
      input: join(faviconDir, 'android-chrome-512x512.png'),
      output: join(faviconDir, 'android-chrome-512x512.png'),
      options: { resize: { width: 512, height: 512 } },
    },
    // Android Chrome 192: 16KB → ~8KB
    {
      input: join(faviconDir, 'android-chrome-192x192.png'),
      output: join(faviconDir, 'android-chrome-192x192.png'),
      options: { resize: { width: 192, height: 192 } },
    },
    // MS Tile: 24KB → ~10KB
    {
      input: join(faviconDir, 'mstile-150x150.png'),
      output: join(faviconDir, 'mstile-150x150.png'),
      options: { resize: { width: 150, height: 150 } },
    },
    // Favicon 32x32: 4KB → ~2KB
    {
      input: join(faviconDir, 'favicon-32x32.png'),
      output: join(faviconDir, 'favicon-32x32.png'),
      options: { resize: { width: 32, height: 32 } },
    },
    // Favicon 16x16: 4KB → ~2KB
    {
      input: join(faviconDir, 'favicon-16x16.png'),
      output: join(faviconDir, 'favicon-16x16.png'),
      options: { resize: { width: 16, height: 16 } },
    },
  ];

  for (const task of tasks) {
    try {
      // 检查文件是否存在
      await stat(task.input);
      const result = await optimizeImage(task.input, task.output, task.options);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️  文件不存在: ${task.input}`);
      } else {
        console.error(`  ❌ 处理失败: ${task.input}`, error.message);
      }
    }
  }

  return results;
}

/**
 * 优化其他图片
 */
async function optimizeOtherImages() {
  console.log('\n📸 开始优化其他图片...\n');

  const results = [];
  const imagesToOptimize = [
    {
      input: join(assetsDir, 'google.png'),
      output: join(assetsDir, 'google.png'),
      options: {},
    },
    {
      input: join(assetsDir, 'fb.png'),
      output: join(assetsDir, 'fb.png'),
      options: {},
    },
  ];

  for (const task of imagesToOptimize) {
    try {
      await stat(task.input);
      const result = await optimizeImage(task.input, task.output, task.options);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️  文件不存在: ${task.input}`);
      } else {
        console.error(`  ❌ 处理失败: ${task.input}`, error.message);
      }
    }
  }

  return results;
}

/**
 * 生成优化报告
 */
function generateReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 优化报告\n');

  if (results.length === 0) {
    console.log('⚠️  没有成功优化的图片');
    return;
  }

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalOptimized = results.reduce((sum, r) => sum + r.optimizedSize, 0);
  const totalSaved = totalOriginal - totalOptimized;
  const totalSavedPercent = ((totalSaved / totalOriginal) * 100).toFixed(1);

  console.log(`✅ 成功优化: ${results.length} 个图片\n`);

  // 详细列表
  console.log('优化详情:');
  results.forEach((r, i) => {
    const fileName = r.input.split('/').pop();
    console.log(
      `  ${i + 1}. ${fileName}: ` +
      `${(r.originalSize / 1024).toFixed(1)}KB → ${(r.optimizedSize / 1024).toFixed(1)}KB ` +
      `(减少${r.savedPercent}%)`
    );
  });

  console.log('\n总计:');
  console.log(`  原始大小: ${(totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`  优化后大小: ${(totalOptimized / 1024).toFixed(1)} KB`);
  console.log(`  节省空间: ${(totalSaved / 1024).toFixed(1)} KB (${totalSavedPercent}%)`);
  console.log('\n' + '='.repeat(80));
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Google-Monetize 图片优化工具\n');
  console.log('目标: 压缩图片以提升LCP性能\n');

  try {
    // 检查目录是否存在
    await stat(assetsDir);

    // 优化Favicon
    const faviconResults = await optimizeFavicons();

    // 优化其他图片
    const otherResults = await optimizeOtherImages();

    // 合并结果
    const allResults = [...faviconResults, ...otherResults];

    // 生成报告
    generateReport(allResults);

    console.log('\n✅ 图片优化完成！');
    console.log('\n💡 下一步:');
    console.log('  1. 运行 npm run build 查看构建大小变化');
    console.log('  2. 提交优化后的图片到Git');
    console.log('  3. 部署到预发环境验证性能改善\n');

  } catch (error) {
    console.error('\n❌ 图片优化失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main();
