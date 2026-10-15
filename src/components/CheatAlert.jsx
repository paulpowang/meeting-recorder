export default function CheatAlert({ card, loading, onDismiss, onKeep }) {
  if (!card && !loading) return null

  return (
    <div className="cheat-overlay" role="alertdialog" aria-live="assertive">
      <div className={`cheat-card ${loading ? 'pulse' : ''}`}>
        <div className="cheat-badge">小抄 · Paul</div>
        {loading ? (
          <p className="cheat-loading">偵測到叫到 Paul，正在產生建議回答…</p>
        ) : (
          <>
            <h2>{card.question || '可能被問到的問題'}</h2>
            {card.question_en && <p className="en-q">{card.question_en}</p>}
            <div className="cheat-answer">
              <div className="label">建議英文短答（可直接說）</div>
              <p className="say">{card.answer_en}</p>
            </div>
            {card.answer_zh && (
              <div className="cheat-zh">
                <div className="label">中文說明</div>
                <p>{card.answer_zh}</p>
              </div>
            )}
            {card.confidence && (
              <p className="confidence">信心：{card.confidence}</p>
            )}
            <div className="row gap">
              <button type="button" className="primary" onClick={onKeep}>
                收入歷史
              </button>
              <button type="button" className="secondary" onClick={onDismiss}>
                關閉
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
