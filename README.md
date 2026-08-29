# 香港小學樂學 HK Primary Learning

根據香港教育局課程指引設計嘅小學生學習 App（PWA），覆蓋小一至小六、中英數常識四科，支援繁中 / English 雙語，可安裝落手機或電腦離線使用。

## 課程依據

| 官方文件 | 應用科目 |
|---|---|
| 《小學教育課程指引》(2024)，2024/25 學年推行 | 整體設計指引 |
| 《中國語文課程指引（小一至小六）》(2023) | 中文 |
| English Language Curriculum Guide (P1–6) 2025 | 英文 |
| 小學數學科學習內容 (2017) | 數學 |
| 2025/26 學年開設小學人文科 + 科學科 | 常識 |

## 功能

- 4 科 × 6 年級 = 24 個學習單元（每單元附教育局學習重點）
- 96 條選擇題（雙語題幹 + 解析）
- 即時作答計分、星數總結
- 進度自動儲存（localStorage）
- 繁中 / English 一鍵切換
- PWA：可安裝、可離線、可「加到主畫面」

## 本地運行

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 部署（GitHub Pages）

1. 將本 repo 推上 GitHub
2. Settings → Pages → Source 揀 `main` 分支（或 `/docs`）
3. 開啟 `https://<用戶名>.github.io/<repo名>/`

## 檔案結構

```
index.html      主頁面（含樣式）
data.js         課程內容 + 題目庫（改內容改呢度）
app.js          互動邏輯
sw.js           Service Worker（離線快取）
manifest.json   PWA 設定
icons/          安裝圖示（192/512/maskable）
```

> 本 App 為學習輔助工具，正式課程以教育局官方文件為準。
