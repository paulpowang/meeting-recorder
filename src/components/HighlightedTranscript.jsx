import { useEffect, useMemo, useRef, useState } from 'react'
import { countPaulMentions, splitPaulSegments, mentionTimestamps } from '../lib/highlight'

function EnLine({ text, activeIdx }) {
  const parts = splitPaulSegments(text || '')
  return (
    <p className="line-en">
      {parts.map((p, i) =>
        p.type === 'paul' ? (
          <mark
            key={i}
            className={`paul-mark ${p.mentionIndex === activeIdx ? 'active' : ''}`}
            data-paul-idx={p.mentionIndex}
          >
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  )
}

/**
 * Bilingual + Paul highlight.
 * segments: [{ id?, text, t, zh?, zhPending? }]
 * If segments provided, render line-by-line with zh under en.
 * Else fall back to flat text.
 */
export default function HighlightedTranscript({
  text = '',
  segments = [],
  interim = '',
  title = '英文逐字稿',
}) {
  const containerRef = useRef(null)
  const [active, setActive] = useState(0)
  const flat = text || segments.map((s) => s.text).join(' ')
  const count = countPaulMentions(flat)
  const marks = useMemo(() => mentionTimestamps(flat, segments), [flat, segments])
  const useLines = segments.length > 0

  // Map global paul index → which segment for scroll
  const paulToSeg = useMemo(() => {
    const map = []
    let offset = 0
    segments.forEach((seg, si) => {
      const hits = (seg.text || '').match(/\bpauls?\b/gi) || []
      hits.forEach(() => map.push(si))
      offset += (seg.text || '').length + 1
    })
    return map
  }, [segments])

  useEffect(() => {
    if (count === 0) setActive(0)
    else if (active >= count) setActive(count - 1)
  }, [count, active])

  function jump(delta) {
    if (count === 0) return
    const next = (active + delta + count) % count
    setActive(next)
    const el =
      containerRef.current?.querySelector(`[data-paul-idx="${next}"]`) ||
      containerRef.current?.querySelector(`[data-seg="${paulToSeg[next]}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList?.add?.('paul-flash')
      setTimeout(() => el.classList?.remove?.('paul-flash'), 900)
    }
  }

  function jumpTo(i) {
    if (count === 0) return
    setActive(i)
    const el =
      containerRef.current?.querySelector(`[data-paul-idx="${i}"]`) ||
      containerRef.current?.querySelector(`[data-seg="${paulToSeg[i]}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('paul-flash')
      setTimeout(() => el.classList.remove('paul-flash'), 900)
    }
  }

  return (
    <section className="card transcript-card grow">
      <div className="transcript-toolbar">
        <h2>{title}</h2>
        <div className="paul-nav" aria-label="Paul 提及導覽">
          <span className="paul-count">
            Paul <strong>{count}</strong>
          </span>
          <button type="button" className="secondary small" disabled={!count} onClick={() => jump(-1)}>
            ▲
          </button>
          <span className="paul-pos">{count ? `${active + 1}/${count}` : '0/0'}</span>
          <button type="button" className="secondary small" disabled={!count} onClick={() => jump(1)}>
            ▼
          </button>
        </div>
      </div>

      {!!marks.length && (
        <div className="paul-timestamps">
          {marks.map((m) => (
            <button
              key={m.mentionIndex}
              type="button"
              className={`ts-chip ${m.mentionIndex === active ? 'active' : ''}`}
              onClick={() => jumpTo(m.mentionIndex)}
            >
              #{m.mentionIndex + 1} · {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="transcript-body" ref={containerRef}>
        {useLines ? (
          <div className="bilingual">
            {segments.map((seg, si) => (
              <div key={seg.id || si} className="bi-line" data-seg={si}>
                <EnLine text={seg.text} activeIdx={active} />
                {seg.zh ? (
                  <p className="line-zh">{seg.zh}</p>
                ) : seg.zhPending ? (
                  <p className="line-zh pending">翻譯中…</p>
                ) : null}
              </div>
            ))}
            {interim ? <p className="interim">{interim}</p> : null}
          </div>
        ) : !flat && !interim ? (
          <p className="empty">尚無文字。開始錄音後會即時顯示。</p>
        ) : (
          <div>
            <EnLine text={flat} activeIdx={active} />
            {interim ? <p className="interim">{interim}</p> : null}
          </div>
        )}
      </div>
      <p className="hint tiny">黃底＋底線標示 Paul／Paul&apos;s；中文行為即時翻譯（可在設定關閉）</p>
    </section>
  )
}
