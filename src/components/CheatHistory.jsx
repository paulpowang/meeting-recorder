export default function CheatHistory({ cards, onClear, onDelete, onBack }) {
  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="ghost" onClick={onBack}>
          ←
        </button>
        <h1>小抄歷史</h1>
        <button type="button" className="ghost danger" onClick={onClear} disabled={!cards.length}>
          清空
        </button>
      </header>

      {!cards.length && <p className="empty">尚無小抄紀錄。錄音並啟用小抄模式後會出現在這裡。</p>}

      <ul className="list">
        {cards.map((c) => (
          <li key={c.id} className="list-item card">
            <div className="meta">
              {new Date(c.createdAt).toLocaleString('zh-TW')}
              {c.confidence ? ` · ${c.confidence}` : ''}
            </div>
            <h3>{c.question}</h3>
            {c.question_en && <p className="en-q">{c.question_en}</p>}
            <p className="say">{c.answer_en}</p>
            {c.answer_zh && <p className="hint">{c.answer_zh}</p>}
            <button type="button" className="secondary small" onClick={() => onDelete(c.id)}>
              刪除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
