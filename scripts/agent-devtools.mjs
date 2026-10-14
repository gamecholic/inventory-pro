// Agent DevTools bridge for shared `npm run dev` sessions.
// Connects to the Electron renderer exposed by src/main/index.ts
// (remote-debugging-port 9222) and gives the agent console / network / DOM.
import { chromium } from '@playwright/test'

const CDP = 'http://127.0.0.1:9222'
const mode = process.argv[2] ?? 'status'

async function rendererPage(browser) {
  const pages = browser.contexts().flatMap((c) => c.pages())
  // Skip DevTools UI itself; prefer the app renderer (vite URL or built file).
  const app = pages.find((p) => !p.url().startsWith('devtools://')) ?? pages[0]
  if (!app) throw new Error('no pages found over CDP')
  return app
}

if (mode === 'status') {
  const res = await fetch(`${CDP}/json/list`)
  if (!res.ok) throw new Error(`CDP not reachable at ${CDP} — restart 'npm run dev' first`)
  const targets = await res.json()
  for (const t of targets) console.log(`${t.type} ${t.url}`)
} else if (mode === 'snapshot') {
  const browser = await chromium.connectOverCDP(CDP)
  try {
    const page = await rendererPage(browser)
    console.log(JSON.stringify({ url: page.url(), title: await page.title() }))
    const html = await page.evaluate(() => document.documentElement.outerHTML.slice(0, 20000))
    console.log(html)
  } finally {
    await browser.close()
  }
} else if (mode === 'eval') {
  const expr = process.argv[3]
  if (!expr) throw new Error('usage: agent-devtools.mjs eval "<js expression>"')
  const browser = await chromium.connectOverCDP(CDP)
  try {
    const page = await rendererPage(browser)
    // eslint-disable-next-line no-eval
    const out = await page.evaluate((e) => eval(e), expr)
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2))
  } finally {
    await browser.close()
  }
} else if (mode === 'selected') {
  const browser = await chromium.connectOverCDP(CDP)
  try {
    const page = await rendererPage(browser)
    const viaPage = await page.evaluate(() => {
      // $0 is set by DevTools when you pick an element in Elements/Inspect.
      const el = globalThis['$0']
      if (!el || !(el instanceof Element)) return 'dollar0-empty'
      const rect = el.getBoundingClientRect().toJSON()
      return `${el.tagName} .${String(el.className).slice(0, 200)} #${el.id} | text=${String(el.textContent).slice(0, 300)} | html=${el.outerHTML.slice(0, 2000)} | rect=${JSON.stringify(rect)}`
    })
    console.log(`page.evaluate: ${viaPage}`)
    try {
      const session = await page.context().newCDPSession(page)
      const res = await session.send('Runtime.evaluate', {
        expression: `(() => { const el = $0; if (!el || !(el instanceof Element)) return 'dollar0-empty'; return el.tagName + ' #' + el.id + ' .' + String(el.className).slice(0,200) + ' | ' + el.outerHTML.slice(0,2000) })()`,
        includeCommandLineAPI: true,
        returnByValue: true
      })
      console.log(`cdp: ${res.result?.value ?? JSON.stringify(res.result)}`)
    } catch (e) {
      console.log(`cdp-err: ${String(e).slice(0, 500)}`)
    }
  } finally {
    await browser.close()
  }
} else if (mode === 'locate') {
  const needle = process.argv.slice(3).join(' ') || 'Aylık Ciro'
  const browser = await chromium.connectOverCDP(CDP)
  try {
    const page = await rendererPage(browser)
    const out = await page.evaluate((text) => {
      const els = Array.from(document.querySelectorAll('div[data-slot="card-content"]'))
      const match = els.find((el) => el.textContent?.includes(text))
        ?? Array.from(document.querySelectorAll('*')).find((el) => el.textContent?.trim() === text)
      if (!match) return `not-found among ${els.length} cards`
      const rect = match.getBoundingClientRect().toJSON()
      match.scrollIntoView({ block: 'center' })
      match.style.outline = '3px solid #f59e0b'
      return `${match.tagName} .${String(match.className).slice(0, 200)} | rect=${JSON.stringify(rect)} | html=${match.outerHTML.slice(0, 2000)}`
    }, needle)
    console.log(out)
  } finally {
    await browser.close()
  }
} else if (mode === 'watch') {
  const secs = Number(process.argv[3] ?? '0') // 0 = forever (agent background shell)
  const browser = await chromium.connectOverCDP(CDP)
  const page = await rendererPage(browser)
  console.log(`watching ${page.url()}`)
  page.on('console', (m) => console.log(`[console:${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => console.log(`[pageerror] ${String(e)}`))
  page.on('request', (r) => console.log(`[request] ${r.method()} ${r.url()}`))
  page.on('response', (r) => console.log(`[response] ${r.status()} ${r.url()}`))
  page.on('requestfailed', (r) => console.log(`[failed] ${r.url()} ${r.failure()?.errorText}`))
  if (secs > 0) await new Promise((r) => setTimeout(r, secs * 1000))
  else await new Promise(() => {})
} else {
  throw new Error('usage: agent-devtools.mjs <status|snapshot|eval|watch>')
}
