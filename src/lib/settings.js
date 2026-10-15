const PROVIDER_KEY = 'vn-ai-provider'
const KEYS = {
  groq: 'vn-key-groq',
  gemini: 'vn-key-gemini',
  openai: 'vn-key-openai',
}
const CONTEXT_KEY = 'vn-paul-context'
const CHEAT_MODE_KEY = 'vn-cheat-mode'
const LIVE_STT_KEY = 'vn-live-stt'

/** Default: free combo — Web Speech live + Groq free key for AI */
export const DEFAULT_PROVIDER = 'groq'

export const PROVIDERS = [
  {
    id: 'groq',
    label: 'Groq（免費額度・建議）',
    hint: '免信用卡。Whisper 轉寫 + Llama／GPT-OSS 翻譯／總結／小抄。免費層約 20 RPM、每日音訊秒數上限。',
    keyUrl: 'https://console.groq.com/keys',
    free: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini（免費層）',
    hint: 'AI Studio 免費額度；Flash 系列輸入／輸出免費但有 RPM／RPD 限制。免費層內容可能用於改進產品。',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: true,
  },
  {
    id: 'openai',
    label: 'OpenAI（需儲值）',
    hint: '新帳號需預付至少約 $5，無常設免費額度。品質高但非 $0。',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: false,
  },
]

export function getProvider() {
  try {
    return localStorage.getItem(PROVIDER_KEY) || DEFAULT_PROVIDER
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
