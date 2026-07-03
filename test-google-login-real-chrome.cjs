/**
 * 使用真实Chrome浏览器测试Google登录
 * 通过CDP (Chrome DevTools Protocol) 连接到本地Chrome
 */

const { chromium } = require('playwright');

async function testWithRealChrome() {
  console.log('🚀 使用真实Chrome浏览器测试Google登录...\n');

  // 方法1: 使用本地已安装的Chrome（推荐）
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // 使用系统安装的Chrome
    args: [
      '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    // 添加真实浏览器的特征
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // 注入脚本隐藏webdriver特征
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // 添加Chrome特有的属性
    window.chrome = {
      runtime: {},
    };
  });

  const page = await context.newPage();

  // 监听关键请求
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/session/sign-in') || 
        url.includes('/api/csrf-token') ||
        url.includes('accounts.google.com/o/oauth2')) {
      console.log(`📤 ${request.method()} ${url.substring(0, 100)}...`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/session/sign-in')) {
      console.log(`📥 Session API: ${status}`);
      if (status >= 400) {
        try {
          const body = await response.text();
          console.log(`   Error: ${body.substring(0, 200)}`);
        } catch (e) {
          // ignore
        }
      }
    }
  });

  // 监听控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });

  try {
    // 1. 访问登录页面
    console.log('1️⃣  访问登录页面...');
    await page.goto('https://www.urlchecker.dev/auth/sign-in', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ 页面加载完成\n');

    // 2. 等待页面稳定
    await page.waitForTimeout(2000);

    // 3. 查找并点击Google登录按钮
    console.log('2️⃣  点击Google登录按钮...');
    const googleButton = page.locator('button[data-provider="google.com"]');
    
    const buttonCount = await googleButton.count();
    if (buttonCount === 0) {
      throw new Error('未找到Google登录按钮');
    }

    await googleButton.click();
    console.log('✅ 已点击Google登录按钮\n');

    // 4. 等待跳转到Google
    console.log('3️⃣  等待跳转到Google OAuth页面...');
    await page.waitForURL(url => url.toString().includes('accounts.google.com'), { 
      timeout: 15000 
    });
    
    const googleUrl = page.url();
    console.log('✅ 已跳转到Google OAuth页面');
    console.log(`   URL: ${googleUrl.substring(0, 100)}...\n`);

    // 5. 检查是否有安全警告
    const pageContent = await page.content();
    if (pageContent.includes('This browser or app may not be secure')) {
      console.log('⚠️  检测到Google安全警告');
      console.log('   这通常是因为浏览器被识别为自动化工具\n');
    } else {
      console.log('✅ 未检测到安全警告，可以正常登录\n');
    }

    // 6. 提示用户手动登录
    console.log('4️⃣  请手动完成Google登录...');
    console.log('   📋 操作步骤:');
    console.log('   1. 在当前页面输入Google账号和密码');
    console.log('   2. 完成任何必要的验证（如2FA）');
    console.log('   3. 点击"允许"授权应用访问');
    console.log('   4. 等待自动跳转回原网站\n');
    
    console.log('   ⏳ 等待跳转回原网站（最多5分钟）...\n');

    // 7. 等待返回到原网站
    await page.waitForURL(url => {
      const urlStr = url.toString();
      return !urlStr.includes('accounts.google.com') && 
             urlStr.includes('urlchecker.dev');
    }, { timeout: 300000 });

    console.log('✅ 已返回到原网站\n');

    // 8. 等待可能的重定向和session创建
    console.log('5️⃣  等待session创建和页面跳转...');
    await page.waitForTimeout(5000);

    // 9. 检查最终状态
    const finalUrl = page.url();
    console.log('6️⃣  检查登录结果...');
    console.log(`   最终URL: ${finalUrl}`);

    if (finalUrl.includes('/dashboard')) {
      console.log('   🎉 登录成功！已跳转到dashboard\n');
    } else if (finalUrl.includes('/auth/sign-in')) {
      console.log('   ⚠️  仍在登录页面，可能登录失败\n');
      
      // 检查是否有错误信息
      const errorVisible = await page.locator('.error-message, [role="alert"]').count();
      if (errorVisible > 0) {
        const errorText = await page.locator('.error-message, [role="alert"]').first().textContent();
        console.log(`   ❌ 错误信息: ${errorText}\n`);
      }
    } else if (finalUrl.includes('/onboarding')) {
      console.log('   ⚠️ 出现了遗留的onboarding重定向，请检查配置\n');
    } else {
      console.log(`   ❓ 跳转到了其他页面\n`);
    }

    // 10. 检查cookies
    console.log('7️⃣  检查session状态...');
    const cookies = await context.cookies();
    const sessionCookies = cookies.filter(c => 
      c.name.includes('session') || 
      c.name === '__session'
    );

    if (sessionCookies.length > 0) {
      console.log('   ✅ 找到session cookies:');
      sessionCookies.forEach(cookie => {
        console.log(`      - ${cookie.name}: ${cookie.value.substring(0, 30)}...`);
        console.log(`        Domain: ${cookie.domain}, Secure: ${cookie.secure}, HttpOnly: ${cookie.httpOnly}`);
      });
    } else {
      console.log('   ❌ 未找到session cookies');
      console.log('   📋 所有cookies:');
      cookies.slice(0, 5).forEach(cookie => {
        console.log(`      - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
    }
    console.log('');

    // 11. 测试认证状态
    console.log('8️⃣  测试认证状态...');
    try {
      await page.goto('https://www.urlchecker.dev/dashboard', {
        waitUntil: 'networkidle',
        timeout: 10000
      });
      
      const dashboardUrl = page.url();
      if (dashboardUrl.includes('/dashboard')) {
        console.log('   ✅ 可以访问dashboard，认证成功！\n');
      } else if (dashboardUrl.includes('/auth/sign-in')) {
        console.log('   ❌ 被重定向到登录页面，认证失败\n');
      }
    } catch (error) {
      console.log(`   ⚠️  访问dashboard时出错: ${error.message}\n`);
    }

    // 12. 保存截图
    console.log('9️⃣  保存测试截图...');
    await page.screenshot({ 
      path: 'real-chrome-login-test.png', 
      fullPage: true 
    });
    console.log('   📸 截图已保存: real-chrome-login-test.png\n');

    // 13. 等待观察
    console.log('🔟 等待10秒后关闭浏览器...');
    await page.waitForTimeout(10000);

    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   Stack:', error.stack);
    
    try {
      await page.screenshot({ 
        path: 'real-chrome-error.png', 
        fullPage: true 
      });
      console.log('📸 错误截图已保存: real-chrome-error.png');
    } catch (e) {
      // ignore screenshot error
    }
  } finally {
    await browser.close();
  }

  console.log('\n📋 测试总结:');
  console.log('如果看到"This browser or app may not be secure"错误:');
  console.log('1. 这是Google的安全检测机制');
  console.log('2. 即使使用真实Chrome，Playwright仍可能被检测到');
  console.log('3. 解决方案: 使用完全手动的浏览器测试');
  console.log('');
  console.log('建议: 直接在普通Chrome浏览器中访问:');
  console.log('https://www.urlchecker.dev/auth/sign-in');
}

// 运行测试
testWithRealChrome().catch(console.error);
