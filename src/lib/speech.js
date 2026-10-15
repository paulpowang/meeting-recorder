export function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Live recognizer with iOS Safari-friendly auto-restart.
 * iOS often ends continuous recognition after a pause; we restart with a short delay.
 */
export function createLiveRecognizer({ onPartial, onFinal, onError, lang = 'en-US' }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = lang
  recognition.maxAlternatives = 1

  let stopped = false
  let restartTimer = null
  let starting = false

  function safeStart() {
    if (stopped || starting) return
    starting = true
    try {
      recognition.start()
    } catch {
      /* InvalidStateError if already started */
    } finally {
      setTimeout(() => {
        starting = false
      }, 300)
    }
  }

  function scheduleRestart(ms = 280) {
    if (stopped) return
    if (restartTimer) clearTimeout(restartTimer)
    restartTimer = setTimeout(() => {
      restartTimer = null
      safeStart()
    }, ms)
  }

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
    const err = e.error || 'speech-error'
    // iOS / Chrome: no-speech and aborted are normal; restart
    if (err === 'aborted') return
    if (err === 'no-speech') {
      scheduleRestart(200)
      return
    }
    if (err === 'network') {
      scheduleRestart(800)
      if (onError) onError(err)
      return
    }
    if (onError) onError(err)
    // Still try to keep listening on soft errors
    if (!stopped && err !== 'not-allowed' && err !== 'service-not-allowed') {
      scheduleRestart(500)
    }
  }

  recognition.onend = () => {
    // Safari often fires onend after each utterance even with continuous=true
    if (!stopped) scheduleRestart(250)
  }

  return {
    start() {
      stopped = false
      safeStart()
    },
    stop() {
      stopped = true
      if (restartTimer) clearTimeout(restartTimer)
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      try {
        recognition.abort()
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
