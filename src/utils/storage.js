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
