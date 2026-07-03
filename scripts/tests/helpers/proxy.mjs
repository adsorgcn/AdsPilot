/**
 * 代理管理辅助工具
 *
 * 功能：
 * 1. 从iprocket API获取代理IP
 * 2. 解析代理IP格式（host:port:username:password）
 * 3. 配置Playwright浏览器使用代理
 *
 * 使用方法：
 * import { getProxyConfig, setupBrowserWithProxy } from './helpers/proxy.mjs';
 *
 * // 获取单个代理IP
 * const proxy = await getProxyConfig();
 *
 * // 启动带代理的浏览器
 * const browser = await setupBrowserWithProxy();
 */

import fetch from 'node-fetch';
import { chromium } from 'playwright';

// 代理配置
const PROXY_URL_US = process.env.PROXY_URL_US ||
  'https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt';

// 代理缓存（避免频繁请求）
let proxyCache = null;
let proxyCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 从iprocket API获取代理IP列表
 * @param {number} count - 需要获取的IP数量（默认1）
 * @returns {Promise<string[]>} 代理IP列表
 */
async function fetchProxyIPs(count = 1) {
  try {
    // 构建请求URL，设置ips参数
    const url = PROXY_URL_US.replace(/ips=\d+/, `ips=${count}`);

    console.log(`   → 获取${count}个代理IP...`);

    const response = await fetch(url, {
      method: 'GET',
      timeout: 10000, // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`代理API返回错误: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    // 解析返回的代理IP（每行一个，格式：host:port:username:password）
    const proxies = text
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (proxies.length === 0) {
      throw new Error('代理API返回空列表');
    }

    console.log(`   ✓ 成功获取${proxies.length}个代理IP`);

    return proxies;

  } catch (error) {
    console.error(`   ❌ 获取代理IP失败: ${error.message}`);
    throw error;
  }
}

/**
 * 解析代理IP字符串
 * @param {string} proxyString - 格式：host:port:username:password
 * @returns {Object} 代理配置对象
 */
function parseProxyString(proxyString) {
  const parts = proxyString.split(':');

  if (parts.length !== 4) {
    throw new Error(`代理IP格式错误: ${proxyString}，期望格式: host:port:username:password`);
  }

  const [host, port, username, password] = parts;

  // Playwright代理配置格式
  return {
    server: `http://${host}:${port}`,
    username: username,
    password: password,
    // 原始信息（用于调试）
    raw: {
      host,
      port,
      username,
      password,
    }
  };
}

/**
 * 获取代理配置（带缓存）
 * @param {boolean} forceRefresh - 是否强制刷新缓存
 * @returns {Promise<Object>} Playwright代理配置对象
 */
export async function getProxyConfig(forceRefresh = false) {
  const now = Date.now();

  // 检查缓存
  if (!forceRefresh && proxyCache && (now - proxyCacheTime) < CACHE_TTL) {
    console.log('   ✓ 使用缓存的代理IP');
    return proxyCache;
  }

  // 获取新的代理IP
  const proxies = await fetchProxyIPs(1);
  const proxyString = proxies[0];

  // 解析代理配置
  const proxyConfig = parseProxyString(proxyString);

  // 更新缓存
  proxyCache = proxyConfig;
  proxyCacheTime = now;

  console.log(`   ✓ 代理配置: ${proxyConfig.server}`);

  return proxyConfig;
}

/**
 * 获取多个代理配置
 * @param {number} count - 代理IP数量
 * @returns {Promise<Object[]>} 代理配置数组
 */
export async function getMultipleProxyConfigs(count = 5) {
  const proxies = await fetchProxyIPs(count);
  return proxies.map(parseProxyString);
}

/**
 * 启动配置了代理的Playwright浏览器
 * @param {Object} options - Playwright启动选项
 * @param {boolean} options.headless - 是否无头模式（默认false）
 * @param {boolean} options.useProxy - 是否使用代理（默认true）
 * @returns {Promise<Browser>} Playwright浏览器实例
 */
export async function setupBrowserWithProxy(options = {}) {
  const {
    headless = false,
    useProxy = true,
    ...otherOptions
  } = options;

  const launchOptions = {
    headless,
    ...otherOptions,
  };

  // 如果需要使用代理，添加代理配置
  if (useProxy) {
    try {
      const proxyConfig = await getProxyConfig();
      launchOptions.proxy = proxyConfig;
      console.log('   ✓ 浏览器已配置代理');
    } catch (error) {
      console.warn(`   ⚠️ 代理配置失败，使用直连: ${error.message}`);
      // 如果代理配置失败，继续使用直连
    }
  }

  const browser = await chromium.launch(launchOptions);
  return browser;
}

/**
 * 创建配置了代理的浏览器上下文
 * @param {Browser} browser - Playwright浏览器实例
 * @param {Object} contextOptions - 上下文选项
 * @returns {Promise<BrowserContext>} 浏览器上下文
 */
export async function createContextWithProxy(browser, contextOptions = {}) {
  // 如果浏览器已经配置了代理，直接创建上下文
  return await browser.newContext(contextOptions);
}

/**
 * 测试代理连接
 * @returns {Promise<boolean>} 代理是否可用
 */
export async function testProxyConnection() {
  console.log('\n🔌 测试代理连接...\n');

  try {
    // 获取代理配置
    const proxyConfig = await getProxyConfig();

    // 启动带代理的浏览器
    const browser = await chromium.launch({
      headless: true,
      proxy: proxyConfig,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // 访问IP检测服务
    console.log('   → 访问IP检测服务...');
    await page.goto('https://api.ipify.org?format=json', {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // 获取IP地址
    const content = await page.content();
    const ipMatch = content.match(/"ip":"([^"]+)"/);
    const proxyIP = ipMatch ? ipMatch[1] : 'Unknown';

    console.log(`   ✓ 代理IP: ${proxyIP}`);
    console.log(`   ✓ 代理服务器: ${proxyConfig.server}`);
    console.log('   ✓ 代理连接正常\n');

    await browser.close();

    return true;

  } catch (error) {
    console.error(`   ❌ 代理连接失败: ${error.message}\n`);
    return false;
  }
}

// 导出常量
export const PROXY_REGIONS = {
  US: 'US',
  ROW: 'ROW', // Rest of World
};

// 如果直接运行此脚本，执行代理连接测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testProxyConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}
