# Telegram 頻道自動同步設置指南

本功能會定時查詢 [銀河系哨俠頻道](https://t.me/universalsentinelsinblack) 的新貼文，自動解析並創建/更新資源收集點和庇護中心信息。

## 功能說明

- **定時任務**: 每 15 分鐘自動檢查一次頻道新貼文
- **智能解析**: 自動識別物資收集站和庇護中心
- **自動分類**: 根據文本內容自動分類到對應區域
- **去重處理**: 避免重複創建相同的資源點

## 設置步驟

### 方法 1: 使用 Telegram Bot API（推薦）

1. **創建 Telegram Bot**
   - 在 Telegram 中搜索 `@BotFather`
   - 發送 `/newbot` 創建新 bot
   - 記下 Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

2. **將 Bot 加入頻道**
   - 將 bot 添加為頻道管理員（至少需要「查看消息」權限）
   - 或者確保頻道是公開的

3. **設置環境變量**
   ```bash
   firebase functions:config:set telegram.bot_token="YOUR_BOT_TOKEN"
   ```

### 方法 2: 使用網頁爬取（無需 Bot Token）

如果無法使用 Bot API，系統會自動使用網頁爬取作為備用方案。無需額外配置。

## 部署函數

```bash
# 進入 functions 目錄
cd functions

# 安裝依賴
npm install

# 構建
npm run build

# 部署
firebase deploy --only functions
```

## 手動觸發測試

部署後，可以通過以下 URL 手動觸發檢查：

```
https://asia-east1-YOUR_PROJECT_ID.cloudfunctions.net/manualCheckTelegram
```

## 定時任務設置

函數部署後，需要在 Firebase Console 中設置 Cloud Scheduler：

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇項目 → Functions → 找到 `checkTelegramChannel`
3. 點擊「創建觸發器」或「設置定時任務」
4. 設置執行頻率：`*/15 * * * *`（每 15 分鐘）

或者使用 gcloud CLI：

```bash
gcloud scheduler jobs create http check-telegram-channel \
  --schedule="*/15 * * * *" \
  --uri="https://asia-east1-YOUR_PROJECT_ID.cloudfunctions.net/checkTelegramChannel" \
  --http-method=GET \
  --time-zone="Asia/Hong_Kong"
```

## 文本解析規則

系統會自動識別以下信息：

- **地點名稱**: 從標題或文本中提取
- **地址**: 識別包含「街」、「路」、「道」、「邨」等的地址
- **地圖連結**: 提取 Google Maps 或 Telegram 地圖連結
- **類別**: 
  - 物資收集站：包含「物資收集」、「收集站」、「捐贈」等關鍵字
  - 庇護中心：包含「庇護」、「避難」、「住宿」等關鍵字
- **狀態**: 識別「開放」、「已滿」、「已關閉」等狀態
- **需要物資**: 提取「水」、「口罩」、「毛巾」等物資關鍵字
- **聯絡方式**: 提取電話號碼或聯絡信息

## 監控和日誌

查看函數執行日誌：

```bash
firebase functions:log --only checkTelegramChannel
```

或在 Firebase Console 中查看：
- Functions → 選擇函數 → Logs

## 故障排除

### Bot API 無法訪問頻道

- 確保 bot 已加入頻道並有查看權限
- 檢查 Bot Token 是否正確
- 系統會自動降級到網頁爬取

### 解析失敗

- 檢查 Firestore 中的 `_metadata/telegram_processed` 文檔
- 查看函數日誌了解具體錯誤
- 可以手動觸發測試函數進行調試

### 重複創建資源點

- 系統會根據地址和地點名稱進行去重
- 如果仍有重複，檢查 Firestore 查詢索引是否正確

## 注意事項

- 網頁爬取可能受到 Telegram 的反爬蟲機制限制
- 建議優先使用 Bot API 以獲得更好的穩定性
- 定時任務會產生 Cloud Functions 執行費用
- 建議根據實際需求調整執行頻率

