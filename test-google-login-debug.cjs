/**
 * Google登录调试测试脚本
 * 专门用于调试Google OAuth登录问题
 */

const { chromium } = require('playwright');

async function debugGoogleLogin() {
  console.log('🔍 启动Google登录调试测试...\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 1000,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security', // 临时禁用CORS检查
      '--disable-features=VizDisplayCompositor',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // 详细的控制台日志监听
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      console.log(`❌ Console Error: ${text}`);
    } else if (type === 'warn') {
      console.log(`⚠️  Console Warning: ${text}`);
    } else if (text.includes('[OAuth]') || text.includes('[Firebase]') || text.includes('[Auth]')) {
      console.log(`📝 Console: ${text}`);
    }
  });

  // 监听所有网络请求
  page.on('request', request => {
    const url = request.url();
    if (url.includes('accounts.google.com') || 
        url.includes('firebase') || 
        url.includes('/api/session') ||
        url.includes('/api/csrf-token')) {
      console.log(`📤 Request: ${request.method()} ${url}`);
    }
  });

  // 监听所有网络响应
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('accounts.google.com') || 
        url.includes('firebase') || 
        url.includes('/api/session') ||
        url.includes('/api/csrf-token')) {
      console.log(`📥 Response: ${status} ${url}`);
      
      if (status >= 400) {
        try {
          const body = await response.text();
          console.log(`   Error Body: ${body.substring(0, 200)}...`);
        } catch (e) {
          console.log('   (无法读取错误响应体)');
        }
      }
    }
  });

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
  });

  try {
    // 1. 访问登录页面
    console.log('1️⃣  访问登录页面...');
    await page.goto('https://www.urlchecker.dev/auth/sign-in', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('✅ 页面加载完成\n');

    // 2. 等待页面完全加载
    await page.waitForTimeout(2000);

    // 3. 检查Firebase配置
    console.log('2️⃣  检查Firebase配置...');
    const firebaseConfig = await page.evaluate(() => {
      // 尝试获取Firebase配置
      try {
        return window.firebase?.apps?.[0]?.options || 'Firebase未初始化';
      } catch (e) {
        return `Firebase配置错误: ${e.message}`;
      }
    });
    console.log('   Firebase配置:', firebaseConfig);
    console.log('');

    // 4. 查找Google登录按钮
    console.log('3️⃣  查找Google登录按钮...');
    
    // 尝试多种选择器
    const selectors = [
      'button[data-provider="google.com"]',
      'button:has-text("Google")',
      'button:has-text("Sign in with Google")',
      '[data-testid="google-auth-button"]',
      '.auth-provider-button'
    ];

    let googleButton = null;
    for (const selector of selectors) {
      try {
        googleButton = await page.locator(selector).first();
        const count = await googleButton.count();
        if (count > 0) {
          console.log(`   ✅ 找到Google按钮 (选择器: ${selector})`);
          break;
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }

    if (!googleButton || await googleButton.count() === 0) {
      console.log('   ❌ 未找到Google登录按钮');
      
      // 截图保存当前页面
      await page.screenshot({ path: 'debug-no-button.png', fullPage: true });
      console.log('   📸 已保存截图: debug-no-button.png');
      
      // 输出页面HTML结构
      const html = await page.content();
      console.log('   📄 页面HTML长度:', html.length);
      
      return;
    }

    // 5. 点击Google登录按钮
    console.log('4️⃣  点击Google登录按钮...');
    
    // 监听popup事件
    const popupPromise = page.waitForEvent('popup', { timeout: 10000 });
    
    await googleButton.click();
    console.log('   ✅ 已点击按钮');

    try {
      const popup = await popupPromise;
      console.log('   ✅ Google OAuth popup已打开');
      console.log(`   🔗 Popup URL: ${popup.url()}`);

      // 检查popup是否是Google OAuth页面
      if (popup.url().includes('accounts.google.com')) {
        console.log('   ✅ 正确跳转到Google OAuth页面');
        
        // 等待用户完成授权
        console.log('   ⏳ 等待用户完成Google授权...');
        console.log('   💡 请在弹出窗口中完成Google登录');
        
        // 等待popup关闭
        await popup.waitForEvent('close', { timeout: 300000 }); // 5分钟
        console.log('   ✅ OAuth popup已关闭');
        
      } else {
        console.log(`   ❌ Popup未跳转到Google OAuth页面: ${popup.url()}`);
        await popup.screenshot({ path: 'debug-popup-error.png' });
        console.log('   📸 已保存popup截图: debug-popup-error.png');
      }
      
    } catch (popupError) {
      console.log(`   ❌ Popup处理失败: ${popupError.message}`);
      
      // 检查是否使用了redirect模式
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      if (currentUrl.includes('accounts.google.com')) {
        console.log('   ℹ️  使用redirect模式，已跳转到Google OAuth页面');
        console.log(`   🔗 当前URL: ${currentUrl}`);
        
        console.log('   ⏳ 等待用户完成授权并返回...');
        // 等待返回到原站点
        await page.waitForURL(url => !url.toString().includes('accounts.google.com'), { timeout: 300000 });
        console.log('   ✅ 已返回到原站点');
      }
    }

    // 6. 检查登录结果
    console.log('5️⃣  检查登录结果...');
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log(`   🔗 最终URL: ${finalUrl}`);
    
    if (finalUrl.includes('/dashboard')) {
      console.log('   ✅ 登录成功！已跳转到dashboard');
    } else if (finalUrl.includes('/auth/sign-in')) {
      console.log('   ⚠️  仍在登录页面，可能登录失败');
    } else {
      console.log(`   ❓ 跳转到了其他页面: ${finalUrl}`);
    }

    // 7. 检查session cookie
    console.log('6️⃣  检查session状态...');
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === '__session' || c.name === 'session');
    
    if (sessionCookie) {
      console.log('   ✅ Session cookie已设置');
      console.log(`   📋 Cookie名称: ${sessionCookie.name}`);
      console.log(`   📋 Cookie域名: ${sessionCookie.domain}`);
      console.log(`   📋 Cookie值长度: ${sessionCookie.value.length}`);
    } else {
      console.log('   ❌ 未找到session cookie');
      console.log('   📋 所有cookies:');
      cookies.forEach(cookie => {
        console.log(`      - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
    }

    // 8. 保存最终截图
    console.log('7️⃣  保存调试截图...');
    await page.screenshot({ path: 'debug-final-result.png', fullPage: true });
    console.log('   📸 已保存截图: debug-final-result.png');

    // 9. 等待观察
    console.log('8️⃣  等待10秒后关闭浏览器...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
    console.log('📸 错误截图已保存: debug-error.png');
  } finally {
    await browser.close();
  }

  console.log('\n✅ 调试测试完成！');
}

// 运行调试测试
debugGoogleLogin().catch(console.error);