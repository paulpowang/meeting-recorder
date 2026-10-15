import { getApiKey, getProvider, getLiveTranslateEngine, getLiveTranslateHybrid } from './settings'
import { findPaulMentions } from './speech'
import { translateLiveBatch } from './ai'

const MYMEMORY = 'https://api.mymemory.translated.net/get'

let browserTranslator = null
let browserTranslatorPromise = null

export function browserTranslatorSupported() {
  return typeof globalThis.Translator === 'function'
}

async function getBrowserTranslator() {
  if (!browserTranslatorSupported()) return null
  if (browserTranslator) return browserTranslator
  if (browserTranslatorPromise) return browserTranslatorPromise
  browserTranslatorPromise = (async () => {
    const pairs = [
      { sourceLanguage: 'en', targetLanguage: 'zh-Hant' },
      { sourceLanguage: 'en', targetLanguage: 'zh-TW' },
      { sourceLanguage: 'en', targetLanguage: 'zh' },
    ]
    for (const opts of pairs) {
      try {
        const avail = await Translator.availability(opts)
        if (avail === 'unavailable') continue
        const t = await Translator.create({
          ...opts,
          monitor(m) {
            m.addEventListener('downloadprogress', () => {})
          },
        })
        browserTranslator = t
        return t
      } catch {
        /* try next pair */
      }
    }
    return null
  })()
  return browserTranslatorPromise
}

async function translateMyMemory(text) {
  const url = `${MYMEMORY}?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en|zh-TW`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MyMemory ${res.status}`)
  const data = await res.json()
  const out = data?.responseData?.translatedText || ''
  if (!out || /INVALID|QUERY LENGTH/i.test(out)) throw new Error('MyMemory 無結果')
  return out
}

async function translateBrowser(text) {
  const t = await getBrowserTranslator()
  if (!t) throw new Error('瀏覽器 Translator API 不可用（多半僅桌面 Chrome／Edge）')
  return (await t.translate(text)).trim()
}

async function translateAi(text) {
  return translateLiveBatch(text)
}

/**
 * Resolve engine for a batch. hybrid = browser/free normally, AI if Paul mentioned.
 */
export async function translateSegmentBatch(texts, { forceAi = false } = {}) {
  const joined = texts.join(' ').trim()
  if (!joined) return texts.map(() => '')

  const engine = getLiveTranslateEngine()
  if (engine === 'off') return texts.map(() => '')

  const hasPaul = texts.some((t) => findPaulMentions(t).length > 0)
  const hybridOpt = getLiveTranslateHybrid() || engine === 'hybrid'

  let mode = engine === 'hybrid' ? (browserTranslatorSupported() ? 'browser' : 'free') : engine
  if (forceAi || (hybridOpt && hasPaul)) {
    mode = 'ai'
  } else if (hybridOpt && !hasPaul) {
    mode = browserTranslatorSupported() ? 'browser' : engine === 'free' ? 'free' : 'browser'
  }

  async function run(modeName) {
    if (modeName === 'ai') {
      if (!getApiKey(getProvider())) throw new Error('未設定 AI Key')
      // One small prompt for the batch; split by numbered lines if multiple
      if (texts.length === 1) return [await translateAi(texts[0])]
      const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')
      const raw = await translateAi(numbered)
      return splitNumbered(raw, texts.length)
    }
    if (modeName === 'browser') {
      const out = []
      for (const t of texts) out.push(await translateBrowser(t))
      return out
    }
    if (modeName === 'free') {
      const out = []
      for (const t of texts) out.push(await translateMyMemory(t))
      return out
    }
    return texts.map(() => '')
  }

  try {
    return await run(mode)
  } catch (e) {
    // Fallback chain for robustness
    if (mode === 'ai') {
      try {
        return await run(browserTranslatorSupported() ? 'browser' : 'free')
      } catch {
        throw e
      }
    }
    if (mode === 'browser') {
      try {
        return await run('free')
      } catch {
        throw e
      }
    }
    throw e
  }
}

function splitNumbered(raw, n) {
  const lines = String(raw)
    .split(/\n+/)
    .map((l) => l.replace(/^\d+[\.)、]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length >= n) return lines.slice(0, n)
  if (n === 1) return [raw.trim()]
  // pad
  const out = []
  for (let i = 0; i < n; i++) out.push(lines[i] || '')
  return out
}

/**
 * Debounced queue: accumulate finalized sentences, flush after delay or size.
 */
export function createLiveTranslateQueue({ onResults, onError, debounceMs = 1500 }) {
  let pending = [] // { id, text }
  let timer = null
  let busy = false
  let closed = false

  async function flush() {
    if (busy || closed || !pending.length) return
    if (getLiveTranslateEngine() === 'off') {
      pending = []
      return
    }
    busy = true
    const batch = pending.splice(0, pending.length)
    try {
      // batch short sentences: prefer 1–3 items or ~280 chars
      const groups = []
      let cur = []
      let len = 0
      for (const item of batch) {
        if (cur.length >= 3 || (len + item.text.length > 280 && cur.length)) {
          groups.push(cur)
          cur = []
          len = 0
        }
        cur.push(item)
        len += item.text.length
      }
      if (cur.length) groups.push(cur)

      for (const group of groups) {
        const zhs = await translateSegmentBatch(group.map((g) => g.text))
        onResults?.(group.map((g, i) => ({ id: g.id, zh: zhs[i] || '' })))
      }
    } catch (e) {
      onError?.(e)
      onResults?.(batch.map((g) => ({ id: g.id, zh: '', error: e.message })))
    } finally {
      busy = false
      if (pending.length) schedule()
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  return {
    enqueue(id, text) {
      if (closed || getLiveTranslateEngine() === 'off') return
      pending.push({ id, text })
      schedule()
    },
    async flushNow() {
      if (timer) clearTimeout(timer)
      await flush()
    },
    close() {
      closed = true
      if (timer) clearTimeout(timer)
      pending = []
    },
  }
}
