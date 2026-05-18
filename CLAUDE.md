# CLAUDE.md - 設備巡回点検PWA

## プロジェクト概要

NFCタグを設備に貼り、スマホをかざすだけで点検入力画面が開く巡回点検システム。
紙の点検表をデジタル化しつつ、既存の巡回フローを一切変えない設計思想。

### ターゲット
- 中小工場の設備保全担当者
- 紙で管理していて「なんとかしたいけど高いシステムは入れられない」層
- Androidスマホ（NFC対応）を使える現場

### 販売形態
- noteで有料記事として販売（3000〜5000円）
- 購入者にPWAのURLを提供
- ホスティングはGitHub PagesまたはVercel（無料）

---

## システム構成

```
[設備]
  ↓ NFCタグ貼付（URLが書いてある）
[スマホ（Android）]
  ↓ かざすだけでブラウザが開く
[PWA スマホUI]
  ↓ 点検入力→JSON保存→エクスポート
[NAS or Googleドライブ]
  ↓ JSONファイル共有
[PC WebUI]
  ↓ JSONインポート
[トレンド分析・巡回状況確認]
```

### 将来オプション（現時点では実装しない）
- 振動センサーハード：ESP32 + ADXL345 + PN532
- BLEでスマホに振動データを送信
- FFT + OA値でベースライン比較・異常検知

---

## スマホPWA仕様

### 基本要件
- **オフライン動作必須**（工場内はWiFi不安定なことが多い）
- Service Workerでキャッシュ
- インストール不要、URLを開くだけで動く
- Android Chrome前提（Web NFC APIを使用）

### 画面フロー
```
起動画面
  ↓
設備選択（NFCかざす or 一覧から選択）
  ↓
点検入力画面（設備ごとのチェック項目）
  ↓
確認画面
  ↓
保存完了（JSONに追記）
```

### UI設計原則（現場向け）
- **文字より色とアイコンで状態を伝える**
- **ボタンは大きく、1画面に1アクション**
- 今何をすべきかが常に画面に表示されている
- グローブしていても操作できるサイズ
- エラーは「何が起きてるか」と「どうすればいいか」をセットで表示

### NFC動作
- タグにはURLを書き込む例：`https://example.com/check/M-001`
- かざすと自動でブラウザが開き該当設備の入力画面が起動
- iOSはWeb NFC非対応のためQRコードをフォールバックとして併用
- 初回アクセス時に「この設備はM-001で合ってますか？」確認を1回表示

---

## データ設計

### 設備マスターJSON（スマホ・PC共通）

```json
{
  "meta": {
    "site": "第一工場",
    "exported": "2026-05-18T09:30:00",
    "version": "1.0"
  },
  "equipment": {
    "M-001": {
      "id": "M-001",
      "name": "送風機#1 モーター",
      "location": "1F 北側",
      "nfc_url": "https://example.com/check/M-001",
      "baseline_oa": 0.38,
      "checks": [
        {"id": "vibration", "label": "振動（聴診）", "type": "3step"},
        {"id": "heat",      "label": "熱（触診）",   "type": "3step"},
        {"id": "current",   "label": "電流",          "type": "3step"},
        {"id": "brush",     "label": "ブラシ火花",    "type": "bool"},
        {"id": "memo",      "label": "備考",          "type": "text"}
      ],
      "records": [
        {
          "date": "2026-05-18",
          "time": "09:23",
          "operator": "田中",
          "results": {
            "vibration": "ok",
            "heat": "ok",
            "current": "warn",
            "brush": false,
            "memo": "電流が少し高め"
          },
          "overall": "warn"
        }
      ]
    }
  }
}
```

### 点検項目のtype一覧
| type | 説明 | 入力UI |
|------|------|--------|
| 3step | 正常/要注意/異常 | 大きなボタン3つ |
| bool | あり/なし | トグル |
| number | 数値入力 | テンキー |
| text | 自由記述 | テキストエリア |

### overallの自動判定ロジック
- いずれかのitが `ng` → overall: `ng`
- いずれかのitが `warn` → overall: `warn`
- 全て `ok` or `false` or 空 → overall: `ok`

---

## PC WebUI仕様

### 機能一覧
1. **サマリーダッシュボード**
   - 異常/要注意/正常/未計測の台数カード
   - 設備一覧（ステータス順ソート）

2. **設備詳細**
   - OA値トレンドグラフ（Recharts）
   - ベースライン/要注意/異常の閾値ライン表示
   - 計測履歴テーブル（日付・結果・担当者）

3. **設備管理**
   - 設備の追加・編集・削除
   - 点検項目のカスタマイズ（追加・削除・並び替え）
   - NFC用URLの自動生成・表示

4. **データ管理**
   - JSONインポート（ドラッグ&ドロップ対応）
   - JSONエクスポート（日付付きファイル名）
   - CSV出力（Excel対応）

### 閾値設定
- システム全体で1つだけ設定可能
- デフォルト：要注意=ベースライン×1.3、異常=ベースライン×1.7
- 設定画面でスライダーで変更可能

---

## ファイル構成

```
/
├── index.html          # PWA スマホUI エントリーポイント
├── dashboard.html      # PC WebUI エントリーポイント
├── manifest.json       # PWA設定
├── sw.js               # Service Worker（オフライン対応）
├── src/
│   ├── app.jsx         # スマホUI メインコンポーネント
│   ├── dashboard.jsx   # PC WebUI メインコンポーネント
│   ├── components/
│   │   ├── CheckInput.jsx    # 点検入力コンポーネント
│   │   ├── NFCReader.jsx     # NFC読取コンポーネント
│   │   ├── TrendChart.jsx    # トレンドグラフ
│   │   └── EquipmentForm.jsx # 設備登録フォーム
│   └── utils/
│       ├── storage.js   # JSON読み書き
│       ├── nfc.js       # NFC操作
│       └── export.js    # エクスポート処理
└── sample/
    └── sample_data.json # サンプルデータ
```

---

## 開発優先順位

### Phase 1（最初に作る）
1. スマホPWAの点検入力UI
2. JSONローカル保存・エクスポート
3. PCダッシュボードのJSONインポート・表示

### Phase 2
4. NFC読取機能
5. QRコードフォールバック
6. PCダッシュボードの設備管理・項目カスタマイズ

### Phase 3（将来）
7. 振動センサーBLE連携
8. FFT・OA値自動計測

---

## 技術スタック
- React + Vite
- Recharts（グラフ）
- Web NFC API（NFC読取）
- Service Worker（オフライン）
- GitHub Pages or Vercel（ホスティング）
- ローカルストレージ + JSONファイル（データ保存）

---

## 注意事項
- Web NFC APIはAndroid Chrome限定
- iOSはQRコードで代替
- クラウド不要設計、セキュリティポリシーが厳しい工場でも使える
- サーバーレス、運用コストゼロ
