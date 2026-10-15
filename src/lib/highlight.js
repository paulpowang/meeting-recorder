/** Case-insensitive word-boundary match for Paul / Paul's */
const PAUL_RE = /\bpauls?\b/gi

export function findPaulMentions(text) {
  if (!text) return []
  const hits = []
  let m
  const re = new RegExp(PAUL_RE.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    hits.push({ index: m.index, length: m[0].length, match: m[0] })
  }
  return hits
}

export function countPaulMentions(text) {
  return findPaulMentions(text).length
}

/**
 * Split text into segments for rendering: { type: 'text'|'paul', value, mentionIndex? }
 * mentionIndex is 0-based among Paul hits only.
 */
export function splitPaulSegments(text) {
  if (!text) return []
  const hits = findPaulMentions(text)
  if (!hits.length) return [{ type: 'text', value: text }]
  const parts = []
  let cursor = 0
  hits.forEach((h, i) => {
    if (h.index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, h.index) })
    }
    parts.push({
      type: 'paul',
      value: text.slice(h.index, h.index + h.length),
      mentionIndex: i,
    })
    cursor = h.index + h.length
  })
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) })
  return parts
}

/**
 * Map global char offsets in a full transcript to timed segments.
 * segments: [{ text, t }] where t is epoch ms or recording-relative ms.
 * Returns [{ mentionIndex, charIndex, match, t, label }]
 */
export function mentionTimestamps(fullText, segments) {
  const hits = findPaulMentions(fullText)
  if (!hits.length) return []

  // Build char-offset → time map from segments concatenated with spaces
  const ranges = []
  let offset = 0
  for (const seg of segments || []) {
    const t = seg.text || ''
    if (!t) continue
    if (offset > 0) offset += 1 // space joiner
    ranges.push({ start: offset, end: offset + t.length, time: seg.t ?? null })
    offset += t.length
  }

  function timeAt(charIndex) {
    for (const r of ranges) {
      if (charIndex >= r.start && charIndex < r.end) return r.time
    }
    // fallback: nearest previous
    let best = null
    for (const r of ranges) {
      if (r.start <= charIndex) best = r.time
    }
    return best
  }

  return hits.map((h, i) => {
    const ms = timeAt(h.index)
    return {
      mentionIndex: i,
      charIndex: h.index,
      match: h.match,
      t: ms,
      label: formatTs(ms, segments),
    }
  })
}

function formatTs(ms, segments) {
  if (ms == null) return '—'
  // If times look like epoch (> year 2001), show clock; else mm:ss from start
  if (ms > 1e12) {
    try {
      return new Date(ms).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return '—'
    }
  }
  const start = segments?.[0]?.t
  const rel = typeof start === 'number' && start < 1e12 ? ms - start : ms
  const total = Math.max(0, Math.floor(rel / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
