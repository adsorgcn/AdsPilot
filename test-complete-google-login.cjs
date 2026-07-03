/**
 * 完整的Google登录端到端测试
 * 包含手动授权步骤的完整流程测试
 */

const { chromium } = require('playwright');

async function testCompleteGoogleLogin() {
  console.log('🚀 启动完整Google登录测试...\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // 监听关键请求
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/session/sign-in') || 
        url.includes('/api/csrf-token') ||
        url.includes('accounts.google.com/o/oauth2') ||
        url.includes('firebaseapp.com/__/auth/handler')) {
      console.log(`📤 ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/session/sign-in')) {
      console.log(`📥 Session API: ${status} ${url}`);
      if (status >= 400) {
        try {
          const body = await response.text();
          console.log(`   Error: ${body}`);
        } catch (e) {
          console.log('   (无法读取错误响应)');
        }
      }
    }
  });

  try {
    // 1. 访问登录页面
    console.log('1️⃣  访问登录页面...');
    await page.goto('https://www.urlchecker.dev/auth/sign-in');
    await page.waitForLoadState('networkidle');
    console.log('✅ 页面加载完成\n');

    // 2. 点击Google登录
    console.log('2️⃣  点击Google登录按钮...');
    const googleButton = page.locator('button[data-provider="google.com"]');
    await googleButton.click();
    console.log('✅ 已点击Google登录按钮\n');

    // 3. 等待跳转到Google
    console.log('3️⃣  等待跳转到Google OAuth页面...');
    await page.waitForURL(url => url.toString().includes('accounts.google.com'), { timeout: 10000 });
    console.log('✅ 已跳转到Google OAuth页面');
    console.log(`   当前URL: ${page.url()}\n`);

    // 4. 提示用户手动登录
    console.log('4️⃣  请手动完成Google登录...');
    console.log('   📋 操作步骤:');
    console.log('   1. 在当前页面输入Google账号和密码');
    console.log('   2. 完成任何必要的验证（如2FA）');
    console.log('   3. 点击"允许"授权应用访问');
    console.log('   4. 等待自动跳转回原网站\n');
    
    console.log('   ⏳ 等待跳转回原网站（最多5分钟）...\n');

    // 5. 等待返回到原网站
    await page.waitForURL(url => !url.toString().includes('accounts.google.com'), { timeout: 300000 });
    console.log('✅ 已返回到原网站');
    
    const returnUrl = page.url();
    console.log(`   返回URL: ${returnUrl}\n`);

    // 6. 等待可能的session创建
    console.log('5️⃣  等待session创建...');
    await page.waitForTimeout(5000);

    // 7. 检查最终状态
    console.log('6️⃣  检查登录结果...');
    const finalUrl = page.url();
    console.log(`   最终URL: ${finalUrl}`);

    if (finalUrl.includes('/dashboard')) {
      console.log('   🎉 登录成功！已跳转到dashboard');
    } else if (finalUrl.includes('/auth/sign-in')) {
      console.log('   ⚠️  仍在登录页面，可能登录失败');
      
      // 检查页面是否有错误信息
      const errorElements = await page.locator('[data-testid="auth-error"], .error-message, .alert-error').count();
      if (errorElements > 0) {
        const errorText = await page.locator('[data-testid="auth-error"], .error-message, .alert-error').first().textContent();
        console.log(`   ❌ 发现错误信息: ${errorText}`);
      }
    } else if (finalUrl.includes('/onboarding')) {
      console.log('   ⚠️ 出现了遗留的onboarding重定向，请检查配置');
    } else {
      console.log(`   ❓ 跳转到了其他页面: ${finalUrl}`);
    }

    // 8. 检查cookies
    console.log('\n7️⃣  检查session状态...');
    const cookies = await context.cookies();
    const sessionCookies = cookies.filter(c => 
      c.name.includes('session') || 
      c.name === '__session' ||
      c.name.includes('firebase')
    );

    if (sessionCookies.length > 0) {
      console.log('   ✅ 找到session相关cookies:');
      sessionCookies.forEach(cookie => {
        console.log(`      - ${cookie.name}: ${cookie.value.substring(0, 30)}... (${cookie.domain})`);
      });
    } else {
      console.log('   ❌ 未找到session cookies');
      console.log('   📋 所有cookies:');
      cookies.forEach(cookie => {
        console.log(`      - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
    }

    // 9. 尝试访问需要认证的页面
    console.log('\n8️⃣  测试认证状态...');
    try {
      await page.goto('https://www.urlchecker.dev/dashboard');
      await page.waitForTimeout(3000);
      
      const dashboardUrl = page.url();
      if (dashboardUrl.includes('/dashboard')) {
        console.log('   ✅ 可以访问dashboard，认证成功');
      } else if (dashboardUrl.includes('/auth/sign-in')) {
        console.log('   ❌ 被重定向到登录页面，认证失败');
      } else {
        console.log(`   ❓ 跳转到了其他页面: ${dashboardUrl}`);
      }
    } catch (error) {
      console.log(`   ❌ 访问dashboard失败: ${error.message}`);
    }

    // 10. 保存截图
    console.log('\n9️⃣  保存测试截图...');
    await page.screenshot({ path: 'complete-login-test.png', fullPage: true });
    console.log('   📸 截图已保存: complete-login-test.png');

    // 11. 等待观察
    console.log('\n🔟 等待10秒后关闭浏览器...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    await page.screenshot({ path: 'complete-login-error.png', fullPage: true });
    console.log('📸 错误截图已保存: complete-login-error.png');
  } finally {
    await browser.close();
  }

  console.log('\n✅ 完整登录测试完成！');
  console.log('\n📋 测试总结:');
  console.log('1. Google OAuth跳转 - 检查是否成功跳转到Google');
  console.log('2. 用户授权 - 检查是否完成了Google授权');
  console.log('3. 返回跳转 - 检查是否返回到原网站');
  console.log('4. Session创建 - 检查是否创建了session cookie');
  console.log('5. 页面跳转 - 检查是否跳转到正确页面');
  console.log('6. 认证状态 - 检查是否可以访问受保护页面');
}

// 运行测试
testCompleteGoogleLogin().catch(console.error);
