import { getApiKey, getProvider, getPaulContext } from './settings'

function requireKey(provider) {
  const key = getApiKey(provider)
  if (!key) {
    const names = { groq: 'Groq', gemini: 'Gemini', openai: 'OpenAI' }
    throw new Error(`尚未設定 ${names[provider] || provider} API Key，請到「設定」填入（可走免費額度）。`)
  }
  return key
}

async function chatComplete({ system, user, json = false }) {
  const provider = getProvider()
  if (provider === 'groq') return groqChat({ system, user, json })
  if (provider === 'gemini') return geminiChat({ system, user, json })
  return openaiChat({ system, user, json })
}

async function groqChat({ system, user, json }) {
  const key = requireKey('groq')
  const body = {
    model: 'openai/gpt-oss-20b',
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (json) body.response_format = { type: 'json_object' }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Groq 失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function openaiChat({ system, user, json }) {
  const key = requireKey('openai')
  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (json) body.response_format = { type: 'json_object' }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenAI 失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function geminiChat({ system, user, json }) {
  const key = requireKey('gemini')
  const model = 'gemini-2.5-flash-lite'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const body = {
    systemInstruction: { parts: [{ text: system + (json ? '\nStrictly output valid JSON only.' : '') }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.3,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gemini 失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() || ''
}

export async function transcribeAudio(blob) {
  const provider = getProvider()
  if (provider === 'gemini') return geminiTranscribe(blob)
  if (provider === 'openai') return openaiTranscribe(blob)
  return groqTranscribe(blob)
}

async function groqTranscribe(blob) {
  const key = requireKey('groq')
  const form = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('file', blob, `audio.${ext}`)
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'en')
  form.append('response_format', 'json')
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Groq 轉寫失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.text || ''
}

async function openaiTranscribe(blob) {
  const key = requireKey('openai')
  const form = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('file', blob, `audio.${ext}`)
  form.append('model', 'gpt-4o-transcribe')
  form.append('language', 'en')
  form.append('response_format', 'json')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`OpenAI 轉寫失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.text || ''
}

async function geminiTranscribe(blob) {
  const key = requireKey('gemini')
  const model = 'gemini-2.5-flash-lite'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const b64 = await blobToBase64(blob)
  const mime = blob.type || 'audio/webm'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Transcribe this English audio to plain text only. No timestamps or commentary.' },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Gemini 轉寫失敗 (${res.status}): ${(await res.text()).slice(0, 220)}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() || ''
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      resolve(s.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Tiny prompt for live line batches — save tokens */
export async function translateLiveBatch(englishText) {
  return chatComplete({
    system: 'EN→zh-TW. Output translation only. Keep names (e.g. Paul).',
    user: englishText.slice(0, 800),
  })
}

export async function translateToZhTw(englishText) {
  return chatComplete({
    system:
      '你是專業翻譯。把使用者提供的英文會議／錄音逐字稿翻成繁體中文（台灣用語）。只輸出譯文，不要加標題或解釋。',
    user: englishText,
  })
}

export async function summarizeTranscript(englishText, zhText) {
  return chatComplete({
    system:
      '你是會議筆記助手。根據逐字稿用繁體中文產出精簡總結：1) 三到五點重點 2) 待辦／決策（若有）3) 一句話結論。使用 markdown 條列。',
    user: `英文逐字稿：\n${englishText}\n\n中文譯文（可參考）：\n${zhText || '（無）'}`,
  })
}

export async function generateCheatSheet(contextText) {
  const roleContext = getPaulContext()
  const raw = await chatComplete({
    json: true,
    system: `你是會議「小抄」助手。聽眾名叫 Paul。根據最近約 60–90 秒的英文會議逐字稿，判斷 Paul 剛剛被問了什麼，並給出建議短答。
${roleContext ? `Paul 的背景／專案脈絡：${roleContext}` : '（使用者未提供 Paul 的背景）'}
嚴格輸出 JSON：
{
  "question": "Paul 被問的問題（繁中一句）",
  "question_en": "the question in English",
  "answer_en": "suggested short spoken answer in English (1-3 sentences)",
  "answer_zh": "中文說明：為什麼這樣答／補充重點",
  "confidence": "high|medium|low"
}
若看不出明確問題，仍盡量推斷並把 confidence 設為 low。`,
    user: contextText,
  })
  try {
    return JSON.parse(raw)
  } catch {
    return {
      question: '無法解析',
      question_en: '',
      answer_en: raw.slice(0, 400),
      answer_zh: '',
      confidence: 'low',
    }
  }
}
