/**
 * Playwright 测试脚本 - 测试 Google OAuth 登录流程
 *
 * 运行方式:
 * npx playwright install chromium  # 首次运行需要安装浏览器
 * node test-google-login.js
 */

const { chromium } = require('playwright');

async function testGoogleLogin() {
  console.log('🚀 启动浏览器测试...\n');

  // 启动浏览器（headless: false 可以看到浏览器窗口）
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // 减慢操作速度，便于观察
  });

  const context = await browser.newContext({
    // 模拟真实浏览器环境
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  // 监听控制台日志
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    } else if (msg.text().includes('[OAuth]') || msg.text().includes('[API]') || msg.text().includes('[CSRF]')) {
      console.log('📝 Console:', msg.text());
    }
  });

  // 监听网络请求
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/session/sign-in') || url.includes('/api/csrf-token')) {
      console.log(`📤 Request: ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/session/sign-in')) {
      console.log(`📥 Response: ${response.status()} ${url}`);
      try {
        const body = await response.text();
        console.log(`   Body: ${body}`);
      } catch (e) {
        console.log('   (无法读取响应体)');
      }
    }
  });

  try {
    // 1. 访问登录页面
    console.log('1️⃣  访问登录页面...');
    await page.goto('https://www.urlchecker.dev/auth/sign-in');
    await page.waitForLoadState('networkidle');
    console.log('✅ 页面加载完成\n');

    // 2. 检查 Google 登录按钮
    console.log('2️⃣  查找 Google 登录按钮...');
    const googleButton = await page.locator('button[data-provider="google.com"]');
    const buttonExists = await googleButton.count() > 0;

    if (!buttonExists) {
      throw new Error('❌ 找不到 Google 登录按钮！');
    }
    console.log('✅ 找到 Google 登录按钮\n');

    // 3. 点击 Google 登录按钮
    console.log('3️⃣  点击 Google 登录按钮...');
    console.log('⚠️  注意: 会弹出 Google 授权窗口，需要手动登录\n');

    // 监听新窗口（popup）
    const popupPromise = page.waitForEvent('popup', { timeout: 60000 });

    await googleButton.click();
    console.log('✅ 已点击按钮，等待 popup...\n');

    // 等待 popup 打开
    const popup = await popupPromise;
    console.log('✅ Google OAuth popup 已打开');
    console.log(`   URL: ${popup.url()}\n`);

    // 4. 等待用户在 popup 中完成授权
    console.log('4️⃣  等待 Google 授权...');
    console.log('⏳ 请在弹出的窗口中完成 Google 登录和授权\n');

    // 等待 popup 关闭（说明授权完成或取消）
    await popup.waitForEvent('close', { timeout: 120000 });
    console.log('✅ Popup 已关闭\n');

    // 5. 等待 session API 调用
    console.log('5️⃣  等待 session 创建...');
    await page.waitForTimeout(2000);

    // 6. 检查是否跳转到 dashboard
    console.log('6️⃣  检查页面跳转...');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`   当前 URL: ${currentUrl}`);

    if (currentUrl.includes('/dashboard')) {
      console.log('✅ 成功跳转到 Dashboard！\n');
    } else if (currentUrl.includes('/auth/sign-in')) {
      console.log('⚠️  仍在登录页面，检查是否有错误\n');
    } else {
      console.log(`⚠️  跳转到了其他页面: ${currentUrl}\n`);
    }

    // 7. 检查 cookies
    console.log('7️⃣  检查 session cookie...');
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');

    if (sessionCookie) {
      console.log('✅ Session cookie 已设置');
      console.log(`   Domain: ${sessionCookie.domain}`);
      console.log(`   Secure: ${sessionCookie.secure}`);
      console.log(`   HttpOnly: ${sessionCookie.httpOnly}`);
      console.log(`   SameSite: ${sessionCookie.sameSite}`);
      console.log(`   Value: ${sessionCookie.value.substring(0, 20)}...\n`);
    } else {
      console.log('❌ 未找到 session cookie\n');
    }

    // 8. 截图保存
    console.log('8️⃣  保存截图...');
    await page.screenshot({ path: '/Users/jason/Documents/Kiro/gm/test-result.png', fullPage: true });
    console.log('✅ 截图已保存到 test-result.png\n');

    // 9. 等待一段时间便于观察
    console.log('⏳ 等待 5 秒后关闭浏览器...\n');
    await page.waitForTimeout(5000);

    console.log('✅ 测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await page.screenshot({ path: '/Users/jason/Documents/Kiro/gm/test-error.png', fullPage: true });
    console.log('📸 错误截图已保存到 test-error.png');
  } finally {
    await browser.close();
  }
}

// 运行测试
testGoogleLogin().catch(console.error);
