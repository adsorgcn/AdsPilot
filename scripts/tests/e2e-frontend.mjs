#!/usr/bin/env node
// Minimal puppeteer-based UI checks for www.urlchecker.dev
// - Anonymous pages: /, /about
// - Screenshot and basic assertions

import puppeteer from 'puppeteer'

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const base = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev'

function log(...a){ console.log('[e2e-ui]', ...a) }

async function open(page, path){
  const url = new URL(path, base).toString()
  log('goto', url)
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  if(!resp) throw new Error('No response for '+url)
  const status = resp.status()
  if(status >= 400) throw new Error('HTTP '+status+' for '+url)
}

async function main(){
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)
  await open(page, '/')
  await page.screenshot({ path: '.kiro/tmp/screen-home.png', fullPage: true })
  await open(page, '/about')
  await page.screenshot({ path: '.kiro/tmp/screen-about.png', fullPage: true })
  log('Anon pages OK')
  await browser.close()
}

main().catch(e=>{ console.error(e); process.exit(1) })

