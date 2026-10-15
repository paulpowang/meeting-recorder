import { useCallback, useEffect, useRef, useState } from 'react'
import Settings from './components/Settings'
import CheatAlert from './components/CheatAlert'
import CheatHistory from './components/CheatHistory'
import HighlightedTranscript from './components/HighlightedTranscript'
import {
  saveRecording,
  listRecordings,
  deleteRecording,
  updateRecording,
  saveCheatCard,
  listCheatCards,
  deleteCheatCard,
  clearCheatCards,
} from './lib/db'
import {
  getCheatModeEnabled,
  getLiveSttEnabled,
  getApiKey,
  getProvider,
} from './lib/settings'
import { createLiveRecognizer, findPaulMentions, sliceRecentTranscript } from './lib/speech'
import { transcribeAudio, translateToZhTw, summarizeTranscript, generateCheatSheet } from './lib/ai'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pickMime() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const t of types) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t
  }
  return ''
}

function formatDuration(ms) {
  const s = Math.floor((ms || 0) / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function App() {
  const [page, setPage] = useState('home') // home | settings | cheat | detail
  const [recs, setRecs] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [liveText, setLiveText] = useState('')
  const [liveInterim, setLiveInterim] = useState('')
  const [liveSegments, setLiveSegments] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [cheatLoading, setCheatLoading] = useState(false)
  const [cheatCard, setCheatCard] = useState(null)
  const [cheatCards, setCheatCards] = useState([])
  const [flash, setFlash] = useState(false)

  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recognizerRef = useRef(null)
  const timerRef = useRef(null)
  const startRef = useRef(0)
  const segmentsRef = useRef([])
  const lastPaulAtRef = useRef(0)
  const cheatBusyRef = useRef(false)

  const refresh = useCallback(async () => {
    setRecs(await listRecordings())
    setCheatCards(await listCheatCards())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopEverything() {
    try {
      recognizerRef.current?.stop()
    } catch {
      /* ignore */
    }
    recognizerRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop()
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks()?.forEach((t) => t.stop())
  }

  async function triggerPaulCheat(fullText) {
    if (!getCheatModeEnabled()) return
    if (!getApiKey(getProvider())) return
    if (cheatBusyRef.current) return
    const now = Date.now()
    if (now - lastPaulAtRef.current < 12000) return // debounce
    lastPaulAtRef.current = now
    cheatBusyRef.current = true
    setFlash(true)
    try {
      navigator.vibrate?.([80, 40, 80, 40, 120])
    } catch {
      /* ignore */
    }
    setTimeout(() => setFlash(false), 1200)
    setCheatLoading(true)
    setCheatCard(null)
    try {
      const ctx = sliceRecentTranscript(segmentsRef.current, 80000) || fullText.slice(-1200)
      const card = await generateCheatSheet(ctx)
      const full = {
        id: uid(),
        createdAt: Date.now(),
        context: ctx,
        ...card,
      }
      setCheatCard(full)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setCheatLoading(false)
      cheatBusyRef.current = false
    }
  }

  function onFinalSpeech(chunk) {
    const t = Date.now()
    segmentsRef.current = [...segmentsRef.current, { text: chunk, t }]
    setLiveSegments(segmentsRef.current)
    setLiveText((prev) => {
      const next = prev ? `${prev} ${chunk}` : chunk
      if (findPaulMentions(chunk).length) triggerPaulCheat(next)
      return next
    })
    setLiveInterim('')
  }

  async function startRecording() {
    setError('')
    setLiveText('')
    setLiveInterim('')
    setLiveSegments([])
    segmentsRef.current = []
    lastPaulAtRef.current = 0
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRef.current = mr
      mr.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const id = uid()
        const rec = {
          id,
          createdAt: Date.now(),
          durationMs: Date.now() - startRef.current,
          mimeType: blob.type,
          blob,
          liveTranscript: liveTextRefText(),
          segments: segmentsRef.current,
          transcript: '',
          translation: '',
          summary: '',
        }
        // capture current live text at stop
        rec.liveTranscript = segmentsRef.current.map((s) => s.text).join(' ')
        await saveRecording(rec)
        await refresh()
        setActiveId(id)
        setPage('detail')
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start(1000)
      startRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250)

      if (getLiveSttEnabled()) {
        const recz = createLiveRecognizer({
          onPartial: (t) => setLiveInterim(t),
          onFinal: onFinalSpeech,
          onError: (err) => {
            if (err !== 'not-allowed') setError(`即時轉寫：${err}`)
          },
        })
        if (recz) {
          recognizerRef.current = recz
          recz.start()
        } else {
          setError('此瀏覽器不支援 Web Speech 即時轉寫（建議 Chrome／Edge）。仍可錄音後用 AI 轉寫。')
        }
      }
    } catch (e) {
      setError(e.message || '無法使用麥克風')
      setRecording(false)
    }
  }

  function liveTextRefText() {
    return segmentsRef.current.map((s) => s.text).join(' ')
  }

  function stopRecording() {
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      recognizerRef.current?.stop()
    } catch {
      /* ignore */
    }
    recognizerRef.current = null
    try {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop()
    } catch {
      /* ignore */
    }
  }

  const active = recs.find((r) => r.id === activeId) || null

  async function runPipeline(kind) {
    if (!active) return
    setError('')
    setBusy(kind)
    try {
      let transcript = active.transcript || active.liveTranscript || ''
      if (kind === 'transcribe' || (kind === 'all' && active.blob)) {
        transcript = await transcribeAudio(active.blob)
        await updateRecording(active.id, { transcript })
      }
      if (!transcript) throw new Error('沒有可用的英文逐字稿，請先轉寫或使用即時轉寫結果。')
      let translation = active.translation || ''
      if (kind === 'translate' || kind === 'all') {
        translation = await translateToZhTw(transcript)
        await updateRecording(active.id, { translation, transcript })
      }
      if (kind === 'summary' || kind === 'all') {
        const summary = await summarizeTranscript(transcript, translation)
        await updateRecording(active.id, { summary, transcript, translation })
      }
      await refresh()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  async function removeRec(id) {
    await deleteRecording(id)
    if (activeId === id) {
      setActiveId(null)
      setPage('home')
    }
    await refresh()
  }

  function downloadRec(rec) {
    const url = URL.createObjectURL(rec.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${new Date(rec.createdAt).toISOString().slice(0, 19)}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function keepCheat() {
    if (cheatCard) {
      await saveCheatCard(cheatCard)
      await refresh()
    }
    setCheatCard(null)
  }

  // Demo seed for screenshots when ?demo=1
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('demo') !== '1') return
    const demoText =
      "Good morning everyone. Paul, can you walk us through the React timeline? " +
      "Sure, thanks. Later Sarah asked Paul's opinion on the Netlify deploy. " +
      "Before we wrap, Paul — any blockers on the PWA?"
    const segs = [
      { text: 'Good morning everyone.', t: 0 },
      { text: 'Paul, can you walk us through the React timeline?', t: 12000 },
      { text: "Sure, thanks. Later Sarah asked Paul's opinion on the Netlify deploy.", t: 45000 },
      { text: 'Before we wrap, Paul — any blockers on the PWA?', t: 78000 },
    ]
    ;(async () => {
      const id = 'demo-paul-highlight'
      const existing = (await listRecordings()).find((r) => r.id === id)
      if (!existing) {
        const silent = new Blob([new Uint8Array(100)], { type: 'audio/webm' })
        await saveRecording({
          id,
          createdAt: Date.now(),
          durationMs: 90000,
          mimeType: 'audio/webm',
          blob: silent,
          liveTranscript: demoText,
          segments: segs,
          transcript: demoText,
          translation:
            '大家早安。Paul，你能說明一下 React 時程嗎？好的，謝謝。之後 Sarah 問了 Paul 對 Netlify 部署的看法。結束前，Paul——PWA 有沒有卡住的地方？',
          summary: '### 重點\n- 討論 React 時程與 Netlify 部署\n- 詢問 PWA 阻礙\n\n### 待辦\n- Paul 回報 PWA 進度',
        })
      }
      await refresh()
      setActiveId(id)
      setPage('detail')
    })()
  }, [refresh])

  if (page === 'settings') return <Settings onBack={() => setPage('home')} />
  if (page === 'cheat') {
    return (
      <CheatHistory
        cards={cheatCards}
        onBack={() => setPage('home')}
        onClear={async () => {
          await clearCheatCards()
          await refresh()
        }}
        onDelete={async (id) => {
          await deleteCheatCard(id)
          await refresh()
        }}
      />
    )
  }

  if (page === 'detail' && active) {
    const en = active.transcript || active.liveTranscript || ''
    return (
      <div className={`app ${flash ? 'screen-flash' : ''}`}>
        <header className="topbar">
          <button type="button" className="ghost" onClick={() => setPage('home')}>
            ←
          </button>
          <h1>錄音詳情</h1>
          <button type="button" className="ghost" onClick={() => setPage('settings')}>
            ⚙
          </button>
        </header>
        <div className="page">
          <section className="card">
            <div className="meta">{new Date(active.createdAt).toLocaleString('zh-TW')} · {formatDuration(active.durationMs)}</div>
            {active.blob && active.blob.size > 200 && (
              <audio controls src={URL.createObjectURL(active.blob)} className="player" />
            )}
            <div className="row gap wrap">
              <button type="button" className="secondary" disabled={!!busy} onClick={() => runPipeline('transcribe')}>
                {busy === 'transcribe' ? '轉寫中…' : 'AI 高品質轉寫'}
              </button>
              <button type="button" className="secondary" disabled={!!busy} onClick={() => runPipeline('translate')}>
                {busy === 'translate' ? '翻譯中…' : '翻成繁中'}
              </button>
              <button type="button" className="secondary" disabled={!!busy} onClick={() => runPipeline('summary')}>
                {busy === 'summary' ? '總結中…' : '自動總結'}
              </button>
              <button type="button" className="primary" disabled={!!busy} onClick={() => runPipeline('all')}>
                {busy === 'all' ? '處理中…' : '一鍵處理'}
              </button>
            </div>
            <div className="row gap">
              <button type="button" className="secondary small" onClick={() => downloadRec(active)}>
                下載
              </button>
              <button type="button" className="secondary small danger" onClick={() => removeRec(active.id)}>
                刪除
              </button>
            </div>
            {error && <p className="err">{error}</p>}
          </section>

          <HighlightedTranscript text={en} segments={active.segments || []} title="英文逐字稿（Paul 標示）" />

          {active.translation && (
            <section className="card">
              <h2>繁中翻譯</h2>
              <p className="transcript-text">{active.translation}</p>
            </section>
          )}
          {active.summary && (
            <section className="card">
              <h2>總結</h2>
              <pre className="summary">{active.summary}</pre>
            </section>
          )}
        </div>
        <CheatAlert
          card={cheatCard}
          loading={cheatLoading}
          onDismiss={() => setCheatCard(null)}
          onKeep={keepCheat}
        />
      </div>
    )
  }

  return (
    <div className={`app ${flash ? 'screen-flash' : ''}`}>
      <header className="topbar">
        <h1>語音筆記</h1>
        <div className="row">
          <button type="button" className="ghost" onClick={() => setPage('cheat')} title="小抄歷史">
            小抄
          </button>
          <button type="button" className="ghost" onClick={() => setPage('settings')} title="設定">
            ⚙
          </button>
        </div>
      </header>

      <div className="page">
        <section className={`card recorder ${recording ? 'live' : ''}`}>
          <p className="hint">
            預設 $0：即時轉寫用 Web Speech；AI 用 Groq 免費 Key（設定頁）。逐字稿會黃底標示 Paul。
          </p>
          <div className="timer">{formatDuration(elapsed)}</div>
          {!recording ? (
            <button type="button" className="rec-btn" onClick={startRecording}>
              開始錄音
            </button>
          ) : (
            <button type="button" className="rec-btn stop" onClick={stopRecording}>
              停止
            </button>
          )}
          {error && <p className="err">{error}</p>}
        </section>

        {recording && (
          <HighlightedTranscript
            text={liveText}
            segments={liveSegments}
            interim={liveInterim}
            title="即時逐字稿"
          />
        )}

        <section className="card">
          <h2>錄音列表</h2>
          {!recs.length && <p className="empty">尚無錄音</p>}
          <ul className="list">
            {recs.map((r) => (
              <li key={r.id} className="list-item row between">
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setActiveId(r.id)
                    setPage('detail')
                  }}
                >
                  <div className="meta">{new Date(r.createdAt).toLocaleString('zh-TW')}</div>
                  <div>
                    {formatDuration(r.durationMs)}
                    {countPaulIn(r) ? ` · Paul ×${countPaulIn(r)}` : ''}
                  </div>
                </button>
                <button type="button" className="secondary small danger" onClick={() => removeRec(r.id)}>
                  刪
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <CheatAlert
        card={cheatCard}
        loading={cheatLoading}
        onDismiss={() => setCheatCard(null)}
        onKeep={keepCheat}
      />
    </div>
  )
}

function countPaulIn(r) {
  const t = r.transcript || r.liveTranscript || ''
  return (t.match(/\bpauls?\b/gi) || []).length
}
