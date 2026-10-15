export function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createLiveRecognizer({ onPartial, onFinal, onError, lang = 'en-US' }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = lang
  recognition.maxAlternatives = 1

  let stopped = false

  recognition.onresult = (event) => {
    let interim = ''
    let finalChunk = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = result[0]?.transcript || ''
      if (result.isFinal) finalChunk += text
      else interim += text
    }
    if (interim && onPartial) onPartial(interim)
    if (finalChunk && onFinal) onFinal(finalChunk.trim())
  }

  recognition.onerror = (e) => {
    if (e.error === 'aborted' || e.error === 'no-speech') return
    if (onError) onError(e.error || 'speech-error')
  }

  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start()
      } catch {
        /* already started */
      }
    }
  }

  return {
    start() {
      stopped = false
      try {
        recognition.start()
      } catch {
        /* ignore */
      }
    },
    stop() {
      stopped = true
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
    },
  }
}

/** Fuzzy match for Paul / Paul's (case-insensitive, word-ish boundary). */
export function findPaulMentions(text) {
  if (!text) return []
  const re = /\bpauls?\b/gi
  const hits = []
  let m
  while ((m = re.exec(text)) !== null) {
    hits.push({ index: m.index, match: m[0] })
  }
  return hits
}

/** Keep roughly the last `windowMs` of timed transcript segments. */
export function sliceRecentTranscript(segments, windowMs = 80000) {
  if (!segments?.length) return ''
  const last = segments[segments.length - 1]
  const end = last.t ?? Date.now()
  const start = end - windowMs
  return segments
    .filter((s) => (s.t ?? 0) >= start)
    .map((s) => s.text)
    .join(' ')
    .trim()
}
