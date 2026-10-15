const PROVIDER_KEY = 'vn-ai-provider'
const KEYS = {
  groq: 'vn-key-groq',
  gemini: 'vn-key-gemini',
  openai: 'vn-key-openai',
}
const CONTEXT_KEY = 'vn-paul-context'
const CHEAT_MODE_KEY = 'vn-cheat-mode'
const LIVE_STT_KEY = 'vn-live-stt'
const LIVE_XL_KEY = 'vn-live-xl-engine'
const LIVE_XL_HYBRID = 'vn-live-xl-hybrid'

export const DEFAULT_PROVIDER = 'groq'

export const PROVIDERS = [
  {
    id: 'groq',
    label: 'Groq（免費額度・建議）',
    hint: '免信用卡。Whisper 轉寫 + LLM 翻譯／總結／小抄。',
    keyUrl: 'https://console.groq.com/keys',
    free: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini（免費層）',
    hint: 'AI Studio 免費額度；免費層內容可能用於改進產品。',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: true,
  },
  {
    id: 'openai',
    label: 'OpenAI（需儲值）',
    hint: '新帳號需預付；無常設免費額度。',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: false,
  },
]

export const LIVE_TRANSLATE_ENGINES = [
  { id: 'ai', label: 'AI（使用者 Key，預設 Groq）' },
  { id: 'browser', label: '瀏覽器內建 Translator（Chrome 桌面）' },
  { id: 'free', label: '免費免 Key（MyMemory）' },
  { id: 'hybrid', label: '瀏覽器／免費為主，Paul 附近才用 AI' },
  { id: 'off', label: '關閉即時翻譯' },
]

export function getProvider() {
  try {
    const p = localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER
    if (p === 'github') return DEFAULT_PROVIDER
    return p
  } catch {
    return DEFAULT_PROVIDER
  }
}

export function setProvider(id) {
  try {
    localStorage.setItem(PROVIDER_KEY, id)
  } catch {
    /* ignore */
  }
}

export function getApiKey(provider = getProvider()) {
  try {
    return localStorage.getItem(KEYS[provider] || KEYS.groq) || ''
  } catch {
    return ''
  }
}

export function setApiKey(provider, value) {
  const k = KEYS[provider]
  if (!k) return
  try {
    if (value) localStorage.setItem(k, value.trim())
    else localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function getPaulContext() {
  try {
    return localStorage.getItem(CONTEXT_KEY) || ''
  } catch {
    return ''
  }
}

export function setPaulContext(value) {
  try {
    if (value) localStorage.setItem(CONTEXT_KEY, value)
    else localStorage.removeItem(CONTEXT_KEY)
  } catch {
    /* ignore */
  }
}

export function getCheatModeEnabled() {
  try {
    const v = localStorage.getItem(CHEAT_MODE_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

export function setCheatModeEnabled(on) {
  try {
    localStorage.setItem(CHEAT_MODE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getLiveSttEnabled() {
  try {
    const v = localStorage.getItem(LIVE_STT_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

export function setLiveSttEnabled(on) {
  try {
    localStorage.setItem(LIVE_STT_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getLiveTranslateEngine() {
  try {
    const stored = localStorage.getItem(LIVE_XL_KEY)
    if (stored) return stored
    // Default: if Groq selected and key present → AI; else free MyMemory
    const prov = localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER
    const key = localStorage.getItem(KEYS[prov] || KEYS.groq) || ''
    if (prov === 'groq' && key.trim()) return 'ai'
    return 'free'
  } catch {
    return 'free'
  }
}

export function setLiveTranslateEngine(id) {
  try {
    localStorage.setItem(LIVE_XL_KEY, id)
  } catch {
    /* ignore */
  }
}

export function getLiveTranslateHybrid() {
  try {
    return localStorage.getItem(LIVE_XL_HYBRID) === '1'
  } catch {
    return false
  }
}

export function setLiveTranslateHybrid(on) {
  try {
    localStorage.setItem(LIVE_XL_HYBRID, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
