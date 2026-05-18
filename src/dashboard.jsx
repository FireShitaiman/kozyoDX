import { useState, useEffect, useRef } from 'react'
import { loadData, saveData, mergeDataList } from './utils/storage'
import { exportMasterJSON, exportCSV } from './utils/export'
import './dashboard.css'

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

function SummaryCard({ label, count, color, active, onClick }) {
  return (
    <button className={`summary-card ${active ? 'active' : ''}`} style={{ borderTopColor: color }} onClick={onClick}>
      <div className="summary-count" style={{ color }}>{count}</div>
      <div className="summary-label">{label}</div>
    </button>
  )
}

function DetailModal({ eq, onClose }) {
  const records = [...(eq.records || [])].reverse()
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{eq.name}</h3>
            <p className="modal-sub">{eq.location} / {eq.id}</p>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {records.length === 0 ? (
            <p className="no-records">点検記録がありません</p>
          ) : (
            <div className="table-scroll">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>時刻</th>
                    <th>作業者</th>
                    <th>総合</th>
                    {eq.checks?.map(c => <th key={c.id}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={i}>
                      <td>{rec.date}</td>
                      <td>{rec.time}</td>
                      <td>{rec.operator}</td>
                      <td>
                        <span className="badge" style={{ background: STATUS_COLOR[rec.overall] }}>
                          {STATUS_LABEL[rec.overall]}
                        </span>
                      </td>
                      {eq.checks?.map(c => {
                        const val = rec.results?.[c.id]
                        let text = '—'
                        if (c.type === '3step' && val) text = STATUS_LABEL[val] || val
                        else if (c.type === 'bool') text = val === true ? 'あり' : val === false ? 'なし' : '—'
                        else if (val !== null && val !== undefined && val !== '') text = String(val)
                        return (
                          <td key={c.id}
                            style={{
                              color: c.type === '3step' && val ? STATUS_COLOR[val] : 'inherit',
                              fontWeight: c.type === '3step' && val ? 700 : 400,
                            }}>
                            {text}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    const saved = loadData()
    if (saved) setData(saved)
  }, [])

  const handleImport = files => {
    const arr = Array.from(files).filter(f => f.name.endsWith('.json'))
    if (arr.length === 0) return
    Promise.all(arr.map(f => f.text().then(t => JSON.parse(t))))
      .then(list => {
        const merged = mergeDataList(list)
        setData(merged)
        saveData(merged)
        const total = Object.values(merged.equipment).reduce((n, eq) => n + (eq.records?.length || 0), 0)
        setImportMsg(`${arr.length}ファイルをマージしました（記録: ${total}件）`)
        setTimeout(() => setImportMsg(''), 4000)
      })
      .catch(() => alert('JSONの読み込みに失敗しました。ファイルを確認してください。'))
  }

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) handleImport(e.dataTransfer.files)
  }

  const onFileChange = e => {
    if (e.target.files.length > 0) handleImport(e.target.files)
    e.target.value = ''
  }

  const eqList = data ? Object.values(data.equipment) : []
  const counts = eqList.reduce((a, eq) => { a[getStatus(eq)]++; return a },
    { ok: 0, warn: 0, ng: 0, unknown: 0 })

  const ORDER = { ng: 0, warn: 1, ok: 2, unknown: 3 }
  const visible = eqList
    .filter(eq => filter === 'all' || getStatus(eq) === filter)
    .sort((a, b) => (ORDER[getStatus(a)] ?? 3) - (ORDER[getStatus(b)] ?? 3))

  const toggleFilter = st => setFilter(f => f === st ? 'all' : st)

  return (
    <div
      className="dash"
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="drop-mask">
          <div className="drop-label">JSONファイルをドロップ（複数可）</div>
        </div>
      )}
      {importMsg && <div className="import-toast">{importMsg}</div>}

      <header className="dash-head">
        <div>
          <h1 className="dash-title">設備点検 ダッシュボード</h1>
          {data && <p className="dash-site">{data.meta?.site}</p>}
        </div>
        <div className="dash-actions">
          <button className="btn-action" onClick={() => fileRef.current?.click()}>⬇ JSONインポート</button>
          <input ref={fileRef} type="file" accept=".json" multiple hidden onChange={onFileChange} />
          {data && <>
            <button className="btn-action" onClick={() => exportMasterJSON(data)}>⬆ masterエクスポート</button>
            <button className="btn-action" onClick={() => exportCSV(data)}>📊 CSV出力</button>
          </>}
        </div>
      </header>

      {!data ? (
        <div className="no-data">
          <p className="no-data-main">データがありません</p>
          <p className="no-data-sub">JSONファイルをインポートするか、スマホアプリで点検を開始してください</p>
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>
            JSONファイルを選択
          </button>
        </div>
      ) : (
        <div className="dash-body">
          <div className="summary-grid">
            <SummaryCard label="異常"  count={counts.ng}      color={STATUS_COLOR.ng}      active={filter === 'ng'}      onClick={() => toggleFilter('ng')} />
            <SummaryCard label="要注意" count={counts.warn}    color={STATUS_COLOR.warn}    active={filter === 'warn'}    onClick={() => toggleFilter('warn')} />
            <SummaryCard label="正常"  count={counts.ok}      color={STATUS_COLOR.ok}      active={filter === 'ok'}      onClick={() => toggleFilter('ok')} />
            <SummaryCard label="未点検" count={counts.unknown} color={STATUS_COLOR.unknown} active={filter === 'unknown'} onClick={() => toggleFilter('unknown')} />
          </div>

          <div className="table-wrap">
            <table className="eq-table">
              <thead>
                <tr>
                  <th>設備ID</th>
                  <th>設備名</th>
                  <th>場所</th>
                  <th>状態</th>
                  <th>最終点検</th>
                  <th>作業者</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(eq => {
                  const st = getStatus(eq)
                  const rec = getLatest(eq)
                  return (
                    <tr key={eq.id} className="eq-row" onClick={() => setDetail(eq)}>
                      <td className="eq-id">{eq.id}</td>
                      <td className="eq-name">{eq.name}</td>
                      <td>{eq.location}</td>
                      <td>
                        <span className="badge" style={{ background: STATUS_COLOR[st] }}>
                          {STATUS_LABEL[st]}
                        </span>
                      </td>
                      <td>{rec ? `${rec.date} ${rec.time}` : '—'}</td>
                      <td>{rec?.operator || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="no-rows">該当する設備がありません</p>
            )}
          </div>
        </div>
      )}

      {detail && <DetailModal eq={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
