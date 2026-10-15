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
  getLiveTranslateEngine,
} from './lib/settings'
import { createLiveRecognizer, findPaulMentions, sliceRecentTranscript } from './lib/speech'
import { createLiveTranslateQueue, createInterimTranslator } from './lib/liveTranslate'
import { APP_BUILD_LABEL } from './lib/version'
import { transcribeAudio, translateToZhTw, summarizeTranscript, generateCheatSheet } from './lib/ai'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
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
  const [page, setPage] = useState('home')
  const [recs, setRecs] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [liveText, setLiveText] = useState('')
  const [liveInterim, setLiveInterim] = useState('')
  const [interimZh, setInterimZh] = useState('')
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
  const xlQueueRef = useRef(null)
  const interimXlRef = useRef(null)

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

  function patchSegment(id, patch) {
    segmentsRef.current = segmentsRef.current.map((s) => (s.id === id ? { ...s, ...patch } : s))
    setLiveSegments([...segmentsRef.current])
  }

  function stopEverything() {
    try {
      recognizerRef.current?.stop()
    } catch {
      /* ignore */
    }
    recognizerRef.current = null
    xlQueueRef.current?.close?.()
    xlQueueRef.current = null
    interimXlRef.current?.close?.()
    interimXlRef.current = null
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
    if (now - lastPaulAtRef.current < 12000) return
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
      setCheatCard({ id: uid(), createdAt: Date.now(), context: ctx, ...card })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setCheatLoading(false)
      cheatBusyRef.current = false
    }
  }

  function onFinalSpeech(chunk) {
    const id = uid()
    const t = Date.now()
    const seg = {
      id,
      text: chunk,
      t,
      zh: '',
      zhPending: getLiveTranslateEngine() !== 'off',
    }
    segmentsRef.current = [...segmentsRef.current, seg]
    setLiveSegments(segmentsRef.current)
    setLiveText((prev) => {
      const next = prev ? `${prev} ${chunk}` : chunk
      if (findPaulMentions(chunk).length) triggerPaulCheat(next)
      return next
    })
    setLiveInterim('')
    setInterimZh('')
    interimXlRef.current?.clear?.()
    xlQueueRef.current?.enqueue(id, chunk)
  }

  async function startRecording() {
    setError('')
    setLiveText('')
    setLiveInterim('')
    setLiveSegments([])
    segmentsRef.current = []
    lastPaulAtRef.current = 0
    chunksRef.current = []
    xlQueueRef.current?.close?.()
    interimXlRef.current?.close?.()
    setInterimZh('')
    xlQueueRef.current = createLiveTranslateQueue({
      debounceMs: 500,
      onResults: (rows) => {
        rows.forEach(({ id, zh }) => patchSegment(id, { zh: zh || '', zhPending: false }))
      },
      onError: (e) => {
        if (e?.message) setError(`即時翻譯：${e.message}`)
      },
    })

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
        try {
          await xlQueueRef.current?.flushNow?.()
        } catch {
          /* ignore */
        }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const id = uid()
        const rec = {
          id,
          createdAt: Date.now(),
          durationMs: Date.now() - startRef.current,
          mimeType: blob.type,
          blob,
          liveTranscript: segmentsRef.current.map((s) => s.text).join(' '),
          segments: segmentsRef.current,
          transcript: '',
          translation: segmentsRef.current
            .map((s) => s.zh)
            .filter(Boolean)
            .join('\n'),
          summary: '',
        }
        await saveRecording(rec)
        await refresh()
        setActiveId(id)
        setPage('detail')
        stream.getTracks().forEach((t) => t.stop())
        xlQueueRef.current?.close?.()
        xlQueueRef.current = null
      }
      mr.start(1000)
      startRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250)

      if (getLiveSttEnabled()) {
        const recz = createLiveRecognizer({
          onPartial: (txt) => {
            setLiveInterim(txt)
            interimXlRef.current?.update?.(txt)
          },
          onFinal: onFinalSpeech,
          onError: (err) => {
            if (err !== 'not-allowed') setError(`即時轉寫：${err}`)
          },
        })
        if (recz) {
          recognizerRef.current = recz
          recz.start()
        } else {
          setError('此瀏覽器不支援 Web Speech（建議 Chrome／Edge）。仍可錄音後用 AI 轉寫。')
        }
      }
    } catch (e) {
      setError(e.message || '無法使用麥克風')
      setRecording(false)
    }
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
        if (active.blob && active.blob.size > 200) {
          transcript = await transcribeAudio(active.blob)
          await updateRecording(active.id, { transcript })
        }
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

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('demo') === '1') {
      const demoText =
        "Good morning everyone. Paul, can you walk us through the React timeline? " +
        "Sure, thanks. Later Sarah asked Paul's opinion on the Netlify deploy. " +
        "Before we wrap, Paul — any blockers on the PWA?"
      const segs = [
        { id: 'd1', text: 'Good morning everyone.', t: 0, zh: '大家早安。' },
        {
          id: 'd2',
          text: 'Paul, can you walk us through the React timeline?',
          t: 12000,
          zh: 'Paul，你能說明一下 React 時程嗎？',
        },
        {
          id: 'd3',
          text: "Sure, thanks. Later Sarah asked Paul's opinion on the Netlify deploy.",
          t: 45000,
          zh: '好的，謝謝。之後 Sarah 問了 Paul 對 Netlify 部署的看法。',
        },
        {
          id: 'd4',
          text: 'Before we wrap, Paul — any blockers on the PWA?',
          t: 78000,
          zh: '結束前，Paul——PWA 有沒有卡住的地方？',
        },
      ]
      ;(async () => {
        const id = 'demo-paul-highlight'
        const existing = (await listRecordings()).find((r) => r.id === id)
        if (!existing) {
          await saveRecording({
            id,
            createdAt: Date.now(),
            durationMs: 90000,
            mimeType: 'audio/webm',
            blob: new Blob([new Uint8Array(100)], { type: 'audio/webm' }),
            liveTranscript: demoText,
            segments: segs,
            transcript: demoText,
            translation: segs.map((s) => s.zh).join('\n'),
            summary: '### 重點\n- 討論 React 時程與 Netlify\n- 詢問 PWA 阻礙\n\n### 待辦\n- Paul 回報進度',
          })
        }
        await refresh()
        setActiveId(id)
        setPage('detail')
      })()
      return
    }
    if (params.get('recdemo') === '1') {
      // Fake recording UI for screenshot (no mic)
      setRecording(true)
      setElapsed(42000)
      setLiveSegments([
        { id: 'r1', text: 'Good morning everyone.', t: 0, zh: '大家早安。' },
        {
          id: 'r2',
          text: 'Paul, can you walk us through the React timeline?',
          t: 12000,
          zh: 'Paul，你能說明一下 React 時程嗎？',
        },
        {
          id: 'r3',
          text: "Sarah asked Paul's opinion on the deploy.",
          t: 28000,
          zh: 'Sarah 問了 Paul 對部署的看法。',
          zhPending: false,
        },
      ])
      setLiveText(
        "Good morning everyone. Paul, can you walk us through the React timeline? Sarah asked Paul's opinion on the deploy.",
      )
      setLiveInterim('any blockers on the…')
    }
  }, [refresh])

  if (page === 'settings') return <Settings onBack={() => setPage(recording ? 'home' : 'home')} />
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
    const segs = active.segments?.length
      ? active.segments
      : en
        ? [{ text: en, t: active.createdAt, zh: '' }]
        : []
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
            <div className="meta">
              {new Date(active.createdAt).toLocaleString('zh-TW')} · {formatDuration(active.durationMs)}
            </div>
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
            </div>
            <button
              type="button"
              className="primary full"
              disabled={!!busy}
              onClick={() => runPipeline('all')}
            >
              {busy === 'all' ? '整理中…' : '會後整理'}
            </button>
            <p className="hint tiny">會後整理：重新轉寫完整錄音 → 翻成繁中 → 產出總結。</p>
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

          <HighlightedTranscript
            text={en}
            segments={segs}
            title="逐字稿（英＋中 · Paul 標示）"
          />

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
        <footer className="app-footer">{APP_BUILD_LABEL} · 語音筆記</footer>
      </div>
    )
  }

  return (
    <div className={`app ${flash ? 'screen-flash' : ''}`}>
      <header className="topbar">
        <h1>語音筆記</h1>
        <div className="row">
          <button type="button" className="ghost" onClick={() => setPage('cheat')}>
            小抄
          </button>
          <button type="button" className="ghost" onClick={() => setPage('settings')}>
            ⚙
          </button>
        </div>
      </header>

      <div className={`page ${recording ? 'recording-layout' : ''}`}>
        {!recording ? (
          <section className="card recorder">
            <p className="hint">
              有 Groq Key 時即時翻譯預設 AI（半即時）。設定頁可改引擎。版本見頁尾。
            </p>
            <div className="timer">{formatDuration(elapsed)}</div>
            <button type="button" className="rec-btn" onClick={startRecording}>
              開始錄音
            </button>
            {error && <p className="err">{error}</p>}
          </section>
        ) : (
          <div className="rec-bar card live">
            <span className="rec-dot" aria-hidden />
            <span className="timer compact">{formatDuration(elapsed)}</span>
            <span className="rec-label">錄音中</span>
            <button type="button" className="stop-btn" onClick={stopRecording}>
              停止
            </button>
          </div>
        )}
        {error && recording && <p className="err pad">{error}</p>}

        {recording && (
          <HighlightedTranscript
            text={liveText}
            segments={liveSegments}
            interim={liveInterim}
            interimZh={interimZh}
            title="即時逐字稿（英＋中）"
          />
        )}

        {!recording && (
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
        )}
      </div>

      <CheatAlert
        card={cheatCard}
        loading={cheatLoading}
        onDismiss={() => setCheatCard(null)}
        onKeep={keepCheat}
      />
      <footer className="app-footer">{APP_BUILD_LABEL} · 語音筆記</footer>
    </div>
  )
}

function countPaulIn(r) {
  const t = r.transcript || r.liveTranscript || ''
  return (t.match(/\bpauls?\b/gi) || []).length
}
