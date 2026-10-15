import { useEffect, useMemo, useRef, useState } from 'react'
import { countPaulMentions, splitPaulSegments, mentionTimestamps } from '../lib/highlight'

/**
 * Renders transcript with Paul highlights + jump nav (no AI).
 * props:
 *  - text: full English transcript
 *  - segments: optional [{text,t}] for timestamps
 *  - interim: optional live interim string
 *  - title: heading
 */
export default function HighlightedTranscript({
  text = '',
  segments = [],
  interim = '',
  title = '英文逐字稿',
}) {
  const containerRef = useRef(null)
  const [active, setActive] = useState(0)
  const count = countPaulMentions(text)
  const parts = useMemo(() => splitPaulSegments(text), [text])
  const marks = useMemo(() => mentionTimestamps(text, segments), [text, segments])

  useEffect(() => {
    if (count === 0) {
      setActive(0)
      return
    }
    if (active >= count) setActive(count - 1)
  }, [count, active])

  function jump(delta) {
    if (count === 0) return
    const next = (active + delta + count) % count
    setActive(next)
    const el = containerRef.current?.querySelector(`[data-paul-idx="${next}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('paul-flash')
      setTimeout(() => el.classList.remove('paul-flash'), 900)
    }
  }

  function jumpTo(i) {
    setActive(i)
    const el = containerRef.current?.querySelector(`[data-paul-idx="${i}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('paul-flash')
      setTimeout(() => el.classList.remove('paul-flash'), 900)
    }
  }

  return (
    <section className="card transcript-card">
      <div className="transcript-toolbar">
        <h2>{title}</h2>
        <div className="paul-nav" aria-label="Paul 提及導覽">
          <span className="paul-count" title="Paul 出現次數">
            Paul <strong>{count}</strong>
          </span>
          <button
            type="button"
            className="secondary small"
            disabled={!count}
            onClick={() => jump(-1)}
            aria-label="上一個 Paul"
          >
            ▲
          </button>
          <span className="paul-pos">
            {count ? `${active + 1}/${count}` : '0/0'}
          </span>
          <button
            type="button"
            className="secondary small"
            disabled={!count}
            onClick={() => jump(1)}
            aria-label="下一個 Paul"
          >
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
        {parts.length === 0 && !interim ? (
          <p className="empty">尚無文字。開始錄音後會即時顯示。</p>
        ) : (
          <p className="transcript-text">
            {parts.map((p, i) =>
              p.type === 'paul' ? (
                <mark
                  key={i}
                  className={`paul-mark ${p.mentionIndex === active ? 'active' : ''}`}
                  data-paul-idx={p.mentionIndex}
                >
                  {p.value}
                </mark>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
            {interim ? <span className="interim"> {interim}</span> : null}
          </p>
        )}
      </div>
      <p className="hint tiny">黃底＋底線標示「Paul／Paul&apos;s」（純前端，不需 AI）</p>
    </section>
  )
}
