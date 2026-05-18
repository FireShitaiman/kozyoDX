import { useState, useEffect, useRef } from 'react'
import CheckInput from './components/CheckInput'
import { loadData, saveData, mergeDataList } from './utils/storage'
import { shareOrExportJSON } from './utils/export'
import './app.css'

const STATUS_COLOR = { ok: '#22c55e', warn: '#f59e0b', ng: '#ef4444', unknown: '#94a3b8' }
const STATUS_LABEL = { ok: '正常', warn: '要注意', ng: '異常', unknown: '未点検' }

function getStatus(eq) {
  const records = eq.records || []
  if (records.length === 0) return 'unknown'
  return records[records.length - 1].overall || 'ok'
}

function getLatest(eq) {
  const records = eq.records || []
  return records.length > 0 ? records[records.length - 1] : null
}

function calcOverall(checks, results) {
  for (const c of checks) {
    if (results[c.id] === 'ng') return 'ng'
  }
  for (const c of checks) {
    if (results[c.id] === 'warn') return 'warn'
  }
  return 'ok'
}

function nowDate() {
  return new Date().toISOString().slice(0, 10)
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5)
}

function StatusBadge({ status, size }) {
  return (
    <span className={`status-badge ${size === 'lg' ? 'status-badge-lg' : ''}`}
      style={{ background: STATUS_COLOR[status] || STATUS_COLOR.unknown }}>
      {STATUS_LABEL[status] || '未点検'}
    </span>
  )
}

// --- Screens ---

function HomeScreen({ data, onSelect, onExport, onImport }) {
  const [operator, setOperator] = useState(() => localStorage.getItem('kozyodx_op') || '')
  const [editing, setEditing] = useState(!localStorage.getItem('kozyodx_op'))
  const importRef = useRef(null)

  const ORDER = { ng: 0, warn: 1, ok: 2, unknown: 3 }
  const list = Object.values(data.equipment).sort(
    (a, b) => (ORDER[getStatus(a)] ?? 3) - (ORDER[getStatus(b)] ?? 3)
  )

  const saveOp = () => {
    localStorage.setItem('kozyodx_op', operator)
    setEditing(false)
  }

  return (
    <div className="screen">
      <header className="app-header">
        <div>
          <h1 className="app-title">設備巡回点検</h1>
          <p className="app-site">{data.meta?.site}</p>
        </div>
        <div className="header-btns">
          <button className="btn-icon" onClick={() => importRef.current?.click()} title="JSONインポート">⬇</button>
          <button className="btn-icon" onClick={onExport} title="送信・エクスポート">⬆</button>
        </div>
        <input ref={importRef} type="file" accept=".json" multiple hidden onChange={e => { onImport(e.target.files); e.target.value = '' }} />
      </header>

      <div className="operator-bar">
        {editing ? (
          <div className="operator-edit-row">
            <input
              className="operator-input"
              type="text"
              value={operator}
              onChange={e => setOperator(e.target.value)}
              placeholder="作業者名を入力"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && operator.trim() && saveOp()}
            />
            <button className="btn-sm" onClick={saveOp} disabled={!operator.trim()}>確定</button>
          </div>
        ) : (
          <div className="operator-row" onClick={() => setEditing(true)}>
            <span>👤 {operator}</span>
            <span className="hint">（変更）</span>
          </div>
        )}
      </div>

      <main className="eq-list">
        {list.length === 0 ? (
          <div className="empty">設備が登録されていません</div>
        ) : (
          list.map(eq => {
            const st = getStatus(eq)
            const rec = getLatest(eq)
            return (
              <button
                key={eq.id}
                className="eq-card"
                style={{ borderLeftColor: STATUS_COLOR[st] }}
                onClick={() => onSelect(eq, operator)}
              >
                <div className="eq-card-body">
                  <div>
                    <div className="eq-name">{eq.name}</div>
                    <div className="eq-loc">{eq.location}</div>
                    {rec && <div className="eq-last">最終: {rec.date} {rec.time} — {rec.operator}</div>}
                  </div>
                  <StatusBadge status={st} />
                </div>
              </button>
            )
          })
        )}
      </main>
    </div>
  )
}

function CheckScreen({ eq, initOperator, onBack, onConfirm }) {
  const [results, setResults] = useState({})
  const [operator, setOperator] = useState(initOperator || '')

  const set = (id, val) => setResults(r => ({ ...r, [id]: val }))

  const required = eq.checks.filter(c => c.type !== 'text')
  const isReady = required.every(c => results[c.id] !== undefined && results[c.id] !== null)

  return (
    <div className="screen">
      <header className="sub-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <div>
          <h2 className="sub-title">{eq.name}</h2>
          <p className="sub-loc">{eq.location}</p>
        </div>
      </header>

      <div className="operator-bar">
        <div className="operator-row">
          <span>👤</span>
          <input
            className="op-inline"
            type="text"
            value={operator}
            onChange={e => setOperator(e.target.value)}
            placeholder="作業者名"
          />
        </div>
      </div>

      <main className="check-form">
        {eq.checks.map(c => (
          <CheckInput
            key={c.id}
            check={c}
            value={results[c.id] ?? null}
            onChange={val => set(c.id, val)}
          />
        ))}
      </main>

      <footer className="screen-footer">
        <button
          className="btn-primary"
          onClick={() => onConfirm({ results, overall: calcOverall(eq.checks, results), operator })}
          disabled={!isReady || !operator.trim()}
        >
          {!operator.trim() ? '作業者名を入力してください' : !isReady ? '全項目を入力してください' : '確認する →'}
        </button>
      </footer>
    </div>
  )
}

function ConfirmScreen({ eq, record, onBack, onSave }) {
  return (
    <div className="screen">
      <header className="sub-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <div>
          <h2 className="sub-title">確認</h2>
          <p className="sub-loc">{eq.name}</p>
        </div>
      </header>

      <main className="confirm-body">
        <div className="confirm-overall">
          <StatusBadge status={record.overall} size="lg" />
        </div>

        <table className="confirm-table">
          <tbody>
            {eq.checks.map(c => {
              const val = record.results[c.id]
              let display = '—'
              if (c.type === '3step' && val) display = STATUS_LABEL[val] || val
              else if (c.type === 'bool') display = val === true ? 'あり' : val === false ? 'なし' : '—'
              else if (val !== null && val !== undefined && val !== '') display = String(val)
              const isStatus = c.type === '3step' && val
              return (
                <tr key={c.id}>
                  <td className="conf-key">{c.label}</td>
                  <td className="conf-val" style={{
                    color: isStatus ? STATUS_COLOR[val] : 'inherit',
                    fontWeight: isStatus ? 'bold' : 'normal'
                  }}>{display}</td>
                </tr>
              )
            })}
            <tr>
              <td className="conf-key">作業者</td>
              <td className="conf-val">{record.operator}</td>
            </tr>
            <tr>
              <td className="conf-key">日時</td>
              <td className="conf-val">{record.date} {record.time}</td>
            </tr>
          </tbody>
        </table>
      </main>

      <footer className="screen-footer">
        <button className="btn-primary" onClick={onSave}>保存する ✓</button>
      </footer>
    </div>
  )
}

function DoneScreen({ onHome }) {
  return (
    <div className="screen screen-center">
      <div className="done-check">✓</div>
      <h2 className="done-msg">保存しました</h2>
      <button className="btn-primary btn-primary-w" onClick={onHome}>ホームに戻る</button>
    </div>
  )
}

// --- App root ---

export default function App() {
  const [data, setData] = useState(null)
  const [screen, setScreen] = useState('home')
  const [selEq, setSelEq] = useState(null)
  const [pending, setPending] = useState(null)

  useEffect(() => {
    const saved = loadData()
    if (saved) {
      setData(saved)
    } else {
      fetch('/sample/sample_data.json')
        .then(r => r.json())
        .then(json => { setData(json); saveData(json) })
        .catch(() => {
          const empty = { meta: { site: '設備点検', exported: '', version: '1.0' }, equipment: {} }
          setData(empty); saveData(empty)
        })
    }
  }, [])

  const handleImport = files => {
    const arr = Array.from(files).filter(f => f.name.endsWith('.json'))
    if (arr.length === 0) return
    Promise.all(arr.map(f => f.text().then(t => JSON.parse(t))))
      .then(list => {
        const merged = data ? mergeDataList([data, ...list]) : mergeDataList(list)
        setData(merged)
        saveData(merged)
      })
      .catch(() => alert('JSONの読み込みに失敗しました'))
  }

  const handleSelect = (eq, op) => { setSelEq(eq); setScreen('check') }

  const handleConfirm = ({ results, overall, operator }) => {
    const record = { date: nowDate(), time: nowTime(), operator, results, overall }
    setPending(record)
    setScreen('confirm')
    localStorage.setItem('kozyodx_op', operator)
  }

  const handleSave = () => {
    const next = { ...data, equipment: { ...data.equipment } }
    const eq = { ...next.equipment[selEq.id] }
    eq.records = [...(eq.records || []), pending]
    next.equipment[selEq.id] = eq
    setData(next)
    saveData(next)
    setScreen('done')
  }

  if (!data) return <div className="loading">読み込み中…</div>

  if (screen === 'home') {
    return <HomeScreen data={data} onSelect={handleSelect} onExport={() => shareOrExportJSON(data)} onImport={handleImport} />
  }
  if (screen === 'check') {
    return (
      <CheckScreen
        eq={selEq}
        initOperator={localStorage.getItem('kozyodx_op') || ''}
        onBack={() => setScreen('home')}
        onConfirm={handleConfirm}
      />
    )
  }
  if (screen === 'confirm') {
    return (
      <ConfirmScreen
        eq={selEq}
        record={pending}
        onBack={() => setScreen('check')}
        onSave={handleSave}
      />
    )
  }
  if (screen === 'done') {
    return <DoneScreen onHome={() => setScreen('home')} />
  }
}
