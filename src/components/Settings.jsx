import { useState, useEffect } from 'react'
import {
  PROVIDERS,
  getProvider,
  setProvider,
  getApiKey,
  setApiKey,
  getPaulContext,
  setPaulContext,
  getCheatModeEnabled,
  setCheatModeEnabled,
  getLiveSttEnabled,
  setLiveSttEnabled,
} from '../lib/settings'

export default function Settings({ onBack }) {
  const [provider, setProv] = useState('groq')
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [context, setContext] = useState('')
  const [cheat, setCheat] = useState(true)
  const [liveStt, setLiveStt] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = getProvider()
    setProv(p)
    setKey(getApiKey(p))
    setContext(getPaulContext())
    setCheat(getCheatModeEnabled())
    setLiveStt(getLiveSttEnabled())
  }, [])

  function onProviderChange(id) {
    setProv(id)
    setKey(getApiKey(id))
  }

  function save() {
    setProvider(provider)
    setApiKey(provider, key)
    setPaulContext(context)
    setCheatModeEnabled(cheat)
    setLiveSttEnabled(liveStt)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function clearKey() {
    setKey('')
    setApiKey(provider, '')
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const meta = PROVIDERS.find((p) => p.id === provider)

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="ghost" onClick={onBack} aria-label="返回">
          ←
        </button>
        <h1>設定</h1>
        <span className="spacer" />
      </header>

      <section className="card">
        <h2>$0 建議組合（預設）</h2>
        <p className="hint">
          即時英文轉寫用瀏覽器 Web Speech（免金鑰）。翻譯／總結／高品質轉寫／小抄預設用{' '}
          <strong>Groq 免費層</strong>（免信用卡）。也可改 Gemini 免費層；OpenAI 需儲值。
        </p>
        <label className="field">
          <span>AI 供應商</span>
          <select value={provider} onChange={(e) => onProviderChange(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {meta && (
          <p className="hint">
            {meta.hint}{' '}
            <a href={meta.keyUrl} target="_blank" rel="noreferrer">
              取得 API Key
            </a>
          </p>
        )}
        <p className="warn">
          金鑰只存在你這台裝置的 localStorage，不會上傳到本 App 伺服器。靜態網站無法安全內建金鑰，所以必須由你自己填入；公用電腦請用完清除。
        </p>
        <label className="field">
          <span>API Key</span>
          <div className="row">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={provider === 'gemini' ? 'AIza...' : 'gsk_... / sk-...'}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="secondary" onClick={() => setShow((s) => !s)}>
              {show ? '隱藏' : '顯示'}
            </button>
          </div>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={liveStt} onChange={(e) => setLiveStt(e.target.checked)} />
          <span>錄音時啟用即時 Web Speech 轉寫（免 AI）</span>
        </label>
        <div className="row gap">
          <button type="button" className="primary" onClick={save}>
            儲存
          </button>
          <button type="button" className="secondary" onClick={clearKey}>
            清除金鑰
          </button>
        </div>
        {saved && <p className="ok">已儲存</p>}
      </section>

      <section className="card">
        <h2>小抄模式（會議）</h2>
        <label className="toggle">
          <input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} />
          <span>偵測到「Paul」時用 AI 產生建議回答</span>
        </label>
        <p className="hint">
          逐字稿中的黃底標示與跳轉<strong>不需要 AI</strong>。小抄建議回答需要上方 API Key。請先取得會議參與者同意再錄音。
        </p>
        <label className="field">
          <span>Paul 的角色／專案脈絡（選填）</span>
          <textarea
            rows={4}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="例如：SFSU CS 學生、正在做 React 專案、負責前端…"
          />
        </label>
        <button type="button" className="primary" onClick={save}>
          儲存設定
        </button>
      </section>
    </div>
  )
}
