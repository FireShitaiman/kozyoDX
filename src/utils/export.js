function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareOrExportJSON(data, operator) {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = operator ? `_${operator.replace(/[\\/:*?"<>|]/g, '')}` : '';
  const filename = `kozyodx_${date}${suffix}.json`;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'application/json' });
      await navigator.share({ files: [file], title: '設備点検データ' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      // share失敗 → ブラウザでファイルを開く（そこから共有・保存できる）
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
  }
  download(blob, filename);
}

export function exportMasterJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  download(blob, 'kozyodx_master.json');
}

export function exportCSV(data) {
  const STATUS = { ok: '正常', warn: '要注意', ng: '異常', unknown: '未点検' };
  const rows = [['設備ID', '設備名', '場所', '日付', '時刻', '作業者', '総合判定']];
  for (const eq of Object.values(data.equipment)) {
    for (const rec of eq.records || []) {
      rows.push([eq.id, eq.name, eq.location, rec.date, rec.time, rec.operator, STATUS[rec.overall] || rec.overall]);
    }
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  download(blob, `kozyodx_${new Date().toISOString().slice(0, 10)}.csv`);
}
