#!/usr/bin/env node
// 测试 Google OAuth 登录流程 - 使用 Puppeteer 打开本地浏览器
// 用途：验证 Firebase Hosting + Cloud Run 集成后的 Google 登录功能

import puppeteer from 'puppeteer'

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const base = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev'

function log(...a){ console.log('[test-google-login]', ...a) }

async function testLogin() {
  log('启动浏览器测试...')

  // 使用独立的测试 profile（可以保存 Google 登录状态）
  const testProfileDir = `${process.env.HOME}/.chrome-test-gm-profile`

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true, // 自动打开开发者工具
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS Chrome 路径
    userDataDir: testProfileDir, // 使用独立测试 profile
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled', // 避免被检测为自动化
      '--no-first-run',
      '--no-default-browser-check'
    ],
    defaultViewport: null // 使用完整窗口大小
  })

  log(`使用测试 profile: ${testProfileDir}`)
  log('💡 首次运行需要手动登录 Google 账号，之后会自动保存登录状态')

  const pages = await browser.pages()
  const page = pages[0] // 使用第一个标签页
  page.setDefaultTimeout(30000)

  // 监听新窗口/弹窗打开
  let popupPage = null
  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const newPage = await target.page()
      const url = newPage.url()
      log(`   🪟 检测到新窗口打开: ${url}`)
      if (url.includes('accounts.google.com')) {
        popupPage = newPage
        log(`   ✅ 找到 Google OAuth 弹窗!`)
      }
    }
  })

  // 监听所有网络请求
  page.on('request', request => {
    const url = request.url()
    if (url.includes('api') || url.includes('auth') || url.includes('session')) {
      log(`   📤 请求: ${request.method()} ${url}`)
    }
  })

  page.on('response', async response => {
    const url = response.url()
    if (url.includes('api') || url.includes('auth') || url.includes('session')) {
      log(`   📥 响应: ${response.status()} ${url}`)

      // 检查 Set-Cookie headers
      const headers = response.headers()
      if (headers['set-cookie']) {
        log(`      🍪 Set-Cookie: ${headers['set-cookie']}`)
      }
    }
  })

  page.on('console', msg => {
    const type = msg.type()
    const text = msg.text()

    if (type === 'error') {
      // 过滤掉 COOP 警告（这是预期的，不影响功能）
      if (!text.includes('Cross-Origin-Opener-Policy')) {
        log(`   ⚠️  浏览器错误: ${text}`)
      }
    } else if (type === 'log' && (text.includes('sign') || text.includes('auth') || text.includes('session'))) {
      log(`   📝 浏览器日志: ${text}`)
    }
  })

  try {
    // 1. 访问首页
    log('1. 访问首页:', base)
    await page.goto(base, { waitUntil: 'networkidle2' })
    await page.screenshot({ path: '.kiro/tmp/login-01-home.png', fullPage: true })

    // 2. 点击登录按钮（尝试多个可能的选择器）
    log('2. 查找登录按钮...')
    const loginSelectors = [
      'a[href*="/auth/sign-in"]',
      'a[href*="/signin"]',
      'a[href*="/login"]',
      'button:has-text("Sign In")',
      'button:has-text("登录")',
      'a:has-text("Sign In")',
      'a:has-text("登录")'
    ]

    let loginButton = null
    for (const selector of loginSelectors) {
      try {
        loginButton = await page.waitForSelector(selector, { timeout: 3000 })
        if (loginButton) {
          log(`   找到登录按钮: ${selector}`)
          break
        }
      } catch (e) {
        continue
      }
    }

    if (!loginButton) {
      log('   未找到登录按钮，尝试直接访问登录页面...')
      await page.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle2' })
    } else {
      // 获取登录链接 URL 并直接访问
      const loginUrl = await page.evaluate(el => el.href, loginButton)
      log(`   登录 URL: ${loginUrl}`)
      await page.goto(loginUrl, { waitUntil: 'networkidle2' })
    }

    await page.screenshot({ path: '.kiro/tmp/login-02-signin-page.png', fullPage: true })
    log('   已到达登录页面')

    // 3. 查找并点击 Google 登录按钮
    log('3. 查找 Google 登录按钮...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 直接使用正确的选择器
    const googleButton = await page.$('button[data-provider="google.com"]')

    if (googleButton) {
      log('   找到 Google 登录按钮: button[data-provider="google.com"]')
    }

    if (!googleButton) {
      // 保存页面内容用于调试
      const html = await page.content()
      const fs = await import('fs')
      fs.writeFileSync('.kiro/tmp/login-page.html', html)
      log('   ⚠️  未找到 Google 登录按钮，页面已保存到 .kiro/tmp/login-page.html')
      log('   请手动点击 Google 登录按钮进行测试')
    } else {
      log('4. 点击 Google 登录按钮...')
      await googleButton.click()
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    await page.screenshot({ path: '.kiro/tmp/login-03-after-google-click.png', fullPage: true })

    // 5. 检查弹窗是否打开
    log('5. 等待 Google OAuth 弹窗...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    if (!popupPage) {
      log('')
      log('⚠️  未检测到 Google OAuth 弹窗打开')
      log('   可能原因：')
      log('   1. 浏览器拦截了弹窗 - 请检查地址栏右侧是否有弹窗拦截图标')
      log('   2. 已经在其他窗口打开 - 请检查所有浏览器窗口')
      log('   3. Firebase Auth 配置问题')
      log('')
      log('   请手动操作：')
      log('   1. 在打开的 Chrome 浏览器中点击 "Continue with Google" 按钮')
      log('   2. 如果看到弹窗拦截提示，点击允许')
      log('   3. 在弹出的 Google 登录窗口完成登录')
      log('')
    } else {
      log('   ✅ Google OAuth 弹窗已打开')
    }

    // 等待用户手动完成 Google 登录
    log('')
    log('╔' + '═'.repeat(68) + '╗')
    log('║  🔔 请在 Google 登录窗口完成操作                             ║')
    log('╠' + '═'.repeat(68) + '╣')
    log('║  1️⃣  查找 Google 登录窗口（可能在后台）                      ║')
    log('║  2️⃣  选择您的 Google 账号                                    ║')
    log('║  3️⃣  点击"继续"或"允许"按钮                                  ║')
    log('║  4️⃣  观察是否自动跳转回应用                                  ║')
    log('╠' + '═'.repeat(68) + '╣')
    log('║  ⏱️  等待时间：最多 5 分钟                                     ║')
    log('║  💡 如未看到弹窗，请在浏览器中手动点击 Continue with Google ║')
    log('║  📸 截图已保存到：.kiro/tmp/login-03-after-google-click.png ║')
    log('╚' + '═'.repeat(68) + '╝')
    log('')

    // 等待用户完成 OAuth 流程，并监控 URL 变化

    const startTime = Date.now()
    const maxWaitTime = 300000 // 5 分钟 - 给用户更多时间

    while (Date.now() - startTime < maxWaitTime) {
      const currentUrl = page.url()

      // 检查是否跳转离开登录页面
      if (!currentUrl.includes('/auth/sign-in')) {
        log(`   ✅ 检测到页面跳转: ${currentUrl}`)
        break
      }

      // 每 5 秒检查一次
      await new Promise(resolve => setTimeout(resolve, 5000))

      // 检查是否有 session cookie
      const cookies = await page.cookies()
      const sessionCookie = cookies.find(c =>
        c.name.includes('session') ||
        c.name.includes('__session') ||
        c.name.includes('token')
      )

      if (sessionCookie) {
        log(`   ✅ 检测到 session cookie: ${sessionCookie.name}`)
        break
      }
    }

    // 6. 检查登录状态
    log('6. 检查登录状态...')
    await page.screenshot({ path: '.kiro/tmp/login-04-after-oauth.png', fullPage: true })

    // 检查 Cookie
    const cookies = await page.cookies()
    log('   Cookies:')
    cookies.forEach(cookie => {
      log(`     - ${cookie.name}: domain=${cookie.domain}, secure=${cookie.secure}`)
    })

    // 检查是否有 session cookie
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') ||
      c.name.includes('token') ||
      c.name.includes('__session')
    )

    if (sessionCookie) {
      log(`   ✅ 找到 session cookie: ${sessionCookie.name}`)
      log(`      domain: ${sessionCookie.domain}`)
      log(`      secure: ${sessionCookie.secure}`)
    } else {
      log('   ⚠️  未找到 session cookie')
    }

    // 检查当前 URL
    const currentUrl = page.url()
    log(`   当前 URL: ${currentUrl}`)

    // 检查页面内容
    const bodyText = await page.evaluate(() => document.body.innerText)
    const hasLoadingText = bodyText.toLowerCase().includes('loading') ||
                           bodyText.includes('加载中')
    const hasErrorText = bodyText.toLowerCase().includes('error') ||
                         bodyText.includes('错误')

    log(`   页面包含 "loading": ${hasLoadingText}`)
    log(`   页面包含 "error": ${hasErrorText}`)

    await page.screenshot({ path: '.kiro/tmp/login-05-final-state.png', fullPage: true })

    // 7. 最终状态检查
    log('7. 最终状态检查...')
    log('   请验证以下内容：')
    log('   - ✓ 是否成功登录？')
    log('   - ✓ 是否卡在加载状态？')
    log('   - ✓ Cookie domain 是否为 .urlchecker.dev？')
    log('   - ✓ Session cookie 是否存在？')
    log('   - ✓ Network 标签中 API 请求是否正常到达 Cloud Run？')

    await page.screenshot({ path: '.kiro/tmp/login-05-final-state.png', fullPage: true })

    log('8. 浏览器将保持打开 60 秒供您检查...')
    log('   请在开发者工具中查看：')
    log('   - Application > Cookies > 检查 domain 是否为 .urlchecker.dev')
    log('   - Network > 检查是否有 /api/session/sign-in 请求')
    await new Promise(resolve => setTimeout(resolve, 60000))

  } catch (error) {
    log('❌ 测试出错:', error.message)
    await page.screenshot({ path: '.kiro/tmp/login-error.png', fullPage: true })
    throw error
  } finally {
    log('关闭浏览器...')
    await browser.close()
  }
}

testLogin()
  .then(() => {
    log('✅ 测试完成')
    process.exit(0)
  })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
