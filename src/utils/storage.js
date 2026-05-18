const KEY = 'kozyodx_data';

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveData(data) {
  data.meta.exported = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function mergeDataList(list) {
  if (list.length === 0) return null;
  const base = JSON.parse(JSON.stringify(list[0]));
  const baseExported = list[0].meta?.exported || '';

  for (let i = 1; i < list.length; i++) {
    const incoming = list[i];
    const incomingIsNewer = (incoming.meta?.exported || '') > baseExported;

    for (const [id, eq] of Object.entries(incoming.equipment || {})) {
      if (!base.equipment[id]) {
        base.equipment[id] = eq;
      } else {
        // records を全ソースからマージ
        const existing = base.equipment[id].records || [];
        const keys = new Set(existing.map(r => `${r.date}|${r.time}|${r.operator}`));
        for (const rec of eq.records || []) {
          if (!keys.has(`${rec.date}|${rec.time}|${rec.operator}`)) {
            existing.push(rec);
            keys.add(`${rec.date}|${rec.time}|${rec.operator}`);
          }
        }
        const merged = existing.sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
        );
        // 設備定義（名前・場所・点検項目）は新しいファイルを優先
        if (incomingIsNewer) {
          base.equipment[id] = { ...eq, records: merged };
        } else {
          base.equipment[id] = { ...base.equipment[id], records: merged };
        }
      }
    }
  }
  return base;
}
