import { getApiKey, getPaulContext } from './settings'

async function requireKey() {
  const key = getApiKey()
  if (!key) {
    throw new Error('尚未設定 OpenAI API Key，請到「設定」頁面填入。')
  }
  return key
}

export async function transcribeAudio(blob, { model = 'gpt-4o-transcribe' } = {}) {
  const key = await requireKey()
  const form = new FormData()
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('file', blob, `audio.${ext}`)
  form.append('model', model)
  form.append('language', 'en')
  form.append('response_format', 'json')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`轉寫失敗 (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.text || ''
}

export async function translateToZhTw(englishText) {
  const key = await requireKey()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是專業翻譯。把使用者提供的英文會議／錄音逐字稿翻成繁體中文（台灣用語）。只輸出譯文，不要加標題或解釋。',
        },
        { role: 'user', content: englishText },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`翻譯失敗 (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function summarizeTranscript(englishText, zhText) {
  const key = await requireKey()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            '你是會議筆記助手。根據逐字稿用繁體中文產出精簡總結：1) 三到五點重點 2) 待辦／決策（若有）3) 一句話結論。使用 markdown 條列。',
        },
        {
          role: 'user',
          content: `英文逐字稿：\n${englishText}\n\n中文譯文（可參考）：\n${zhText || '（無）'}`,
        },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`總結失敗 (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

/**
 * Cheat-sheet: given ~60-90s of transcript around a "Paul" mention,
 * ask what Paul was asked and suggest a short answer.
 */
export async function generateCheatSheet(contextText) {
  const key = await requireKey()
  const roleContext = getPaulContext()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是會議「小抄」助手。聽眾名叫 Paul。根據最近約 60–90 秒的英文會議逐字稿，判斷 Paul 剛剛被問了什麼，並給出建議短答。
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
        },
        { role: 'user', content: contextText },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`小抄產生失敗 (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || '{}'
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
