import { useState, useEffect, useRef } from 'react'
import { loadData, saveData, mergeDataList } from './utils/storage'
import { exportMasterJSON, exportCSV } from './utils/export'
import './dashboard.css'

const STATUS_COLOR = { ok: '#22c55e', warn: '#f59e0b', ng: '#ef4444', unknown: '#94a3b8' }
const STATUS_LABEL = { ok: '正常', warn: '要注意', ng: '異常', unknown: '未点検' }
const STALE_DAYS = 7

function getStatus(eq) {
  const records = eq.records || []
  if (records.length === 0) return 'unknown'
  return records[records.length - 1].overall || 'ok'
}

function getLatest(eq) {
  const records = eq.records || []
  return records.length > 0 ? records[records.length - 1] : null
}

function getConsecutiveAlertCount(eq) {
  const records = eq.records || []
  let count = 0
  for (let i = records.length - 1; i >= 0; i--) {
    const o = records[i].overall
    if (o === 'warn' || o === 'ng') count++
    else break
  }
  return count
}

function getDaysSince(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today - new Date(dateStr)) / 86400000)
}

function getStaleDays(eq) {
  const rec = getLatest(eq)
  return rec ? getDaysSince(rec.date) : null
}

function SummaryCard({ label, count, color, active, onClick }) {
  return (
    <button className={`summary-card ${active ? 'active' : ''}`} style={{ borderTopColor: color }} onClick={onClick}>
      <div className="summary-count" style={{ color }}>{count}</div>
      <div className="summary-label">{label}</div>
    </button>
  )
}

function AlertBar({ eqList }) {
  const staleCount = eqList.filter(eq => {
    const d = getStaleDays(eq)
    return d !== null && d >= STALE_DAYS
  }).length
  const consecCount = eqList.filter(eq => getConsecutiveAlertCount(eq) >= 2).length
  if (staleCount === 0 && consecCount === 0) return null
  return (
    <div className="alert-bar">
      {staleCount > 0 && (
        <span className="alert-chip alert-stale">⏱ {staleCount}台が{STALE_DAYS}日以上未点検</span>
      )}
      {consecCount > 0 && (
        <span className="alert-chip alert-consec">🔴 {consecCount}台で連続異常を検出</span>
      )}
    </div>
  )
}

function RecordTable({ eq, records }) {
  return (
    <div className="table-scroll">
      <table className="rec-table">
        <thead>
          <tr>
            <th>日付</th><th>時刻</th><th>作業者</th><th>総合</th>
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
                  <td key={c.id} style={{
                    color: c.type === '3step' && val ? STATUS_COLOR[val] : 'inherit',
                    fontWeight: c.type === '3step' && val ? 700 : 400,
                  }}>{text}</td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
            <RecordTable eq={eq} records={records} />
          )}
        </div>
      </div>
    </div>
  )
}

function MonthlyReport({ data, onClose }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const allYears = new Set([now.getFullYear()])
  for (const eq of Object.values(data.equipment)) {
    for (const rec of (eq.records || [])) {
      allYears.add(parseInt(rec.date.slice(0, 4)))
    }
  }
  const years = [...allYears].sort()

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const eqList = Object.values(data.equipment)

  const reportRows = eqList.map(eq => ({
    ...eq,
    monthRecords: (eq.records || []).filter(r => r.date.startsWith(monthStr)),
  }))

  const counts = reportRows.reduce(
    (a, eq) => {
      if (eq.monthRecords.length === 0) { a.no_record++; return a }
      const last = eq.monthRecords[eq.monthRecords.length - 1].overall
      a[last] = (a[last] || 0) + 1
      return a
    },
    { ok: 0, warn: 0, ng: 0, no_record: 0 }
  )

  const totalChecks = reportRows.reduce((n, eq) => n + eq.monthRecords.length, 0)

  return (
    <div className="overlay printable" onClick={onClose}>
      <div className="modal report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head no-print">
          <h3 className="modal-title">月次点検レポート</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="month-sel" value={year} onChange={e => setYear(+e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select className="month-sel" value={month} onChange={e => setMonth(+e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                <option key={m} value={m}>{m}月</option>
              )}
            </select>
            <button className="btn-action" onClick={() => window.print()}>🖨 印刷/PDF保存</button>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body report-body">
          <div className="report-hd">
            <h2>{data.meta?.site} 月次点検レポート</h2>
            <p className="report-period">{year}年{month}月</p>
            <p className="report-meta">対象設備: {eqList.length}台 / 点検実施回数: {totalChecks}回</p>
          </div>

          <div className="report-summary">
            {[
              { key: 'ng',      label: '異常',    count: counts.ng },
              { key: 'warn',    label: '要注意',  count: counts.warn },
              { key: 'ok',      label: '正常',    count: counts.ok },
              { key: 'unknown', label: '記録なし', count: counts.no_record },
            ].map(({ key, label, count }) => (
              <div key={key} className="rep-chip" style={{ borderColor: STATUS_COLOR[key], color: STATUS_COLOR[key] }}>
                <span className="rep-chip-num">{count}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {reportRows.map(eq => (
            <div key={eq.id} className="report-eq-section">
              <div className="report-eq-head">
                <strong>{eq.name}</strong>
                <span className="report-eq-meta">{eq.id} / {eq.location}</span>
                {eq.monthRecords.length === 0 && (
                  <span className="badge" style={{ background: STATUS_COLOR.unknown }}>記録なし</span>
                )}
              </div>
              {eq.monthRecords.length > 0 && (
                <RecordTable eq={eq} records={eq.monthRecords} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [report, setReport] = useState(false)
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
            <button className="btn-action" onClick={() => setReport(true)}>📋 月次レポート</button>
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
            <SummaryCard label="異常"   count={counts.ng}      color={STATUS_COLOR.ng}      active={filter === 'ng'}      onClick={() => toggleFilter('ng')} />
            <SummaryCard label="要注意"  count={counts.warn}    color={STATUS_COLOR.warn}    active={filter === 'warn'}    onClick={() => toggleFilter('warn')} />
            <SummaryCard label="正常"   count={counts.ok}      color={STATUS_COLOR.ok}      active={filter === 'ok'}      onClick={() => toggleFilter('ok')} />
            <SummaryCard label="未点検"  count={counts.unknown} color={STATUS_COLOR.unknown} active={filter === 'unknown'} onClick={() => toggleFilter('unknown')} />
          </div>

          <AlertBar eqList={eqList} />

          {filter !== 'all' && (
            <div className="filter-strip">
              <span className="filter-strip-label">
                「{STATUS_LABEL[filter]}」でフィルタ中 — {visible.length}台表示
              </span>
              <button className="btn-clear-filter" onClick={() => setFilter('all')}>
                ✕ 全て表示
              </button>
            </div>
          )}

          <div className="table-wrap">
            <table className="eq-table">
              <thead>
                <tr>
                  <th>設備ID</th><th>設備名</th><th>場所</th><th>状態</th><th>最終点検</th><th>作業者</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(eq => {
                  const st = getStatus(eq)
                  const rec = getLatest(eq)
                  const consec = getConsecutiveAlertCount(eq)
                  const staleDays = getStaleDays(eq)
                  const isStale = staleDays !== null && staleDays >= STALE_DAYS
                  return (
                    <tr key={eq.id} className="eq-row" onClick={() => setDetail(eq)}>
                      <td className="eq-id">{eq.id}</td>
                      <td className="eq-name">{eq.name}</td>
                      <td>{eq.location}</td>
                      <td>
                        <span className="badge" style={{ background: STATUS_COLOR[st] }}>
                          {STATUS_LABEL[st]}
                        </span>
                        {consec >= 2 && (
                          <span className="badge-consec" style={{
                            background: st === 'ng' ? '#fee2e2' : '#fef3c7',
                            borderColor: st === 'ng' ? '#fca5a5' : '#fbbf24',
                            color: st === 'ng' ? '#991b1b' : '#92400e',
                          }}>{consec}連続</span>
                        )}
                      </td>
                      <td className={isStale ? 'stale-cell' : ''}>
                        {rec ? `${rec.date} ${rec.time}` : '—'}
                        {isStale && <span className="stale-days"> ({staleDays}日経過)</span>}
                      </td>
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
      {report && <MonthlyReport data={data} onClose={() => setReport(false)} />}
    </div>
  )
}
