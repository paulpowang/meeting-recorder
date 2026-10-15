import { useState, useEffect } from 'react'
import {
  PROVIDERS,
  LIVE_TRANSLATE_ENGINES,
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
  getLiveTranslateEngine,
  setLiveTranslateEngine,
  getLiveTranslateHybrid,
  setLiveTranslateHybrid,
} from '../lib/settings'
import { browserTranslatorSupported } from '../lib/liveTranslate'
import { APP_BUILD_LABEL, APP_VERSION } from '../lib/version'

export default function Settings({ onBack }) {
  const [provider, setProv] = useState('groq')
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [context, setContext] = useState('')
  const [cheat, setCheat] = useState(true)
  const [liveStt, setLiveStt] = useState(true)
  const [xlEngine, setXlEngine] = useState('free')
  const [xlHybrid, setXlHybrid] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = getProvider()
    setProv(p)
    setKey(getApiKey(p))
    setContext(getPaulContext())
    setCheat(getCheatModeEnabled())
    setLiveStt(getLiveSttEnabled())
    setXlEngine(getLiveTranslateEngine())
    setXlHybrid(getLiveTranslateHybrid())
  }, [])

  function onProviderChange(id) {
    setProv(id)
    const k = getApiKey(id)
    setKey(k)
    // When switching to Groq with a key, prefer AI live translation
    if (id === 'groq' && k.trim() && (xlEngine === 'free' || !localStorage.getItem('vn-live-xl-engine'))) {
      setXlEngine('ai')
    }
  }

  function onKeyChange(v) {
    setKey(v)
    if (provider === 'groq' && v.trim() && xlEngine === 'free') {
      setXlEngine('ai')
    }
  }

  function save() {
    setProvider(provider)
    setApiKey(provider, key)
    setPaulContext(context)
    setCheatModeEnabled(cheat)
    setLiveSttEnabled(liveStt)
    setLiveTranslateEngine(xlEngine)
    setLiveTranslateHybrid(xlHybrid)
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

      <section className="card highlight-card" id="live-translate-settings">
        <div className="badge-row">
          <h2>即時中文翻譯引擎</h2>
          <span className="pill">必看</span>
        </div>
        <p className="hint">
          每個英文定稿句約 0.5 秒內翻成繁中；說話中也會對「暫定句」做半即時翻譯。有 Groq Key
          時預設用 AI。
        </p>
        <label className="field">
          <span className="field-label-lg">翻譯引擎（請選擇）</span>
          <select
            className="select-lg"
            value={xlEngine}
            onChange={(e) => setXlEngine(e.target.value)}
          >
            {LIVE_TRANSLATE_ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={xlHybrid || xlEngine === 'hybrid'}
            onChange={(e) => setXlHybrid(e.target.checked)}
            disabled={xlEngine === 'hybrid' || xlEngine === 'off' || xlEngine === 'ai'}
          />
          <span>平常用瀏覽器／免費，遇到 Paul 才用 AI</span>
        </label>
        <p className="hint tiny">
          {browserTranslatorSupported()
            ? '此瀏覽器支援 Translator API。'
            : 'iPhone Safari 通常沒有瀏覽器 Translator；請選 AI（Groq）或免費 MyMemory。'}
        </p>
        <button type="button" className="primary full" onClick={save}>
          儲存翻譯設定
        </button>
        {saved && <p className="ok">已儲存</p>}
      </section>

      <section className="card">
        <h2>AI 供應商與金鑰</h2>
        <p className="hint">
          會後整理／小抄／（可選）即時 AI 翻譯使用此 Key。預設 Groq 免費層。
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
        <p className="warn">金鑰只存在本機 localStorage，不會上傳到此網站伺服器。</p>
        <label className="field">
          <span>API Key</span>
          <div className="row">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => onKeyChange(e.target.value)}
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
          <span>錄音時啟用即時 Web Speech 轉寫</span>
        </label>
        <div className="row gap">
          <button type="button" className="primary" onClick={save}>
            儲存
          </button>
          <button type="button" className="secondary" onClick={clearKey}>
            清除金鑰
          </button>
        </div>
      </section>

      <section className="card">
        <h2>小抄模式（會議）</h2>
        <label className="toggle">
          <input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} />
          <span>偵測到「Paul」時用 AI 產生建議回答</span>
        </label>
        <label className="field">
          <span>Paul 的角色／專案脈絡（選填）</span>
          <textarea
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="例如：SFSU CS 學生、負責前端…"
          />
        </label>
        <button type="button" className="primary" onClick={save}>
          儲存設定
        </button>
      </section>

      <section className="card muted">
        <h2>版本</h2>
        <p className="version-line">
          {APP_BUILD_LABEL} <span className="meta">（build {APP_VERSION}）</span>
        </p>
        <p className="hint tiny">
          若 iPhone 仍看到舊畫面：到主畫面刪除 PWA → Safari 重新開啟網址 → 加入主畫面。本版會自動更新
          Service Worker。
        </p>
      </section>
    </div>
  )
}
