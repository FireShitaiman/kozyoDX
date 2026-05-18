const COLOR = { ok: '#22c55e', warn: '#f59e0b', ng: '#ef4444' }

export default function CheckInput({ check, value, onChange }) {
  if (check.type === '3step') {
    const options = [
      { v: 'ok',   label: '正常',   color: COLOR.ok   },
      { v: 'warn', label: '要注意', color: COLOR.warn },
      { v: 'ng',   label: '異常',   color: COLOR.ng   },
    ]
    return (
      <div className="check-item">
        <div className="check-label">{check.label}</div>
        <div className="check-3step">
          {options.map(opt => (
            <button
              key={opt.v}
              className={`btn-3step ${value === opt.v ? 'selected' : ''}`}
              style={{ '--btn-color': opt.color, opacity: value && value !== opt.v ? 0.4 : 1 }}
              onClick={() => onChange(value === opt.v ? null : opt.v)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (check.type === 'bool') {
    return (
      <div className="check-item">
        <div className="check-label">{check.label}</div>
        <div className="check-bool">
          <button
            className={`btn-bool ${value === false ? 'selected' : ''}`}
            style={{ '--btn-color': COLOR.ok }}
            onClick={() => onChange(false)}
          >
            なし
          </button>
          <button
            className={`btn-bool ${value === true ? 'selected' : ''}`}
            style={{ '--btn-color': COLOR.ng }}
            onClick={() => onChange(true)}
          >
            あり
          </button>
        </div>
      </div>
    )
  }

  if (check.type === 'number') {
    return (
      <div className="check-item">
        <div className="check-label">{check.label}</div>
        <input
          type="number"
          className="check-number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value !== '' ? Number(e.target.value) : null)}
          inputMode="decimal"
        />
      </div>
    )
  }

  if (check.type === 'text') {
    return (
      <div className="check-item">
        <div className="check-label">{check.label}</div>
        <textarea
          className="check-text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          rows={3}
          placeholder="入力してください（任意）"
        />
      </div>
    )
  }

  return null
}
