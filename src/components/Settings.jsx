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
    setKey(getApiKey(id))
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

      <section className="card">
        <h2>$0 建議組合（預設）</h2>
        <p className="hint">
          即時英文轉寫用 Web Speech（免金鑰）。翻譯／總結／小抄預設用 <strong>Groq</strong>；也可改
          Gemini。即時中文翻譯預設 MyMemory（免 Key），可改 AI／瀏覽器 Translator。
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
          金鑰只存在本機 localStorage。靜態網站無法安全內建金鑰，請自行填入；公用電腦請用完清除。
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
        <h2>即時中文翻譯</h2>
        <p className="hint">
          每個 Web Speech 定稿句會 debounce～1.5 秒後批次翻成繁中，顯示在英文下方。
          {browserTranslatorSupported()
            ? ' 此瀏覽器支援 Translator API。'
            : ' 此環境可能不支援瀏覽器 Translator（多半僅桌面 Chrome／Edge）。'}
        </p>
        <label className="field">
          <span>翻譯引擎</span>
          <select value={xlEngine} onChange={(e) => setXlEngine(e.target.value)}>
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
          <span>平常用瀏覽器／免費引擎，遇到 Paul 才改用 AI（省額度）</span>
        </label>
        <button type="button" className="primary" onClick={save}>
          儲存設定
        </button>
      </section>

      <section className="card">
        <h2>小抄模式（會議）</h2>
        <label className="toggle">
          <input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} />
          <span>偵測到「Paul」時用 AI 產生建議回答</span>
        </label>
        <p className="hint">
          黃底標示與跳轉不需 AI。小抄建議需 API Key。請先取得會議參與者同意再錄音。
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
