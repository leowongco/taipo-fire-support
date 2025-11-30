# Cloudflare Workers - 新聞抓取定時任務

此 Cloudflare Worker 替代了原本的 Python cron job，使用 Cloudflare Workers 的 Cron Triggers 來定時執行新聞抓取任務。

## 功能

- **定時任務**：
  - 每 10 分鐘同時檢查政府新聞公報和 RTHK 即時新聞
  - 自動使用 AI 進行新聞分類
- **手動觸發**：提供 HTTP 端點用於手動觸發和測試
- **健康檢查**：提供 `/health` 端點用於監控

## 快速設置

如果你已經部署了 Firebase Functions，可以使用快速設置腳本：

```bash
cd workers
./setup-env.sh
```

或者手動設置（見下方詳細步驟）。

## 設置步驟

### 1. 安裝依賴

```bash
cd workers
npm install
```

### 2. 獲取 Firebase Functions URL

首先，你需要獲取 Firebase Functions 的手動觸發端點 URL：

1. 部署 Firebase Functions：
   ```bash
   cd ../functions
   npm run build
   firebase deploy --only functions
   ```

2. 在 Firebase Console 中找到 Functions URL：
   - 訪問 [Firebase Console](https://console.firebase.google.com/)
   - 選擇你的項目
   - 進入 Functions 頁面
   - 找到 `manualCheckGovNews` 和 `manualCheckRTHKNews` 函數
   - 複製它們的 URL（格式類似：`https://[region]-[project-id].cloudfunctions.net/manualCheckGovNews`）

### 3. 設置 Cloudflare Workers

#### 方法 1: 使用 Wrangler CLI（推薦）

1. 安裝 Wrangler CLI（如果還沒有）：
   ```bash
   npm install -g wrangler
   ```

2. 登入 Cloudflare：
   ```bash
   wrangler login
   ```

3. 設置環境變量：

   **快速設置（推薦）**：
   ```bash
   ./setup-env.sh
   ```

   **手動設置**：
   ```bash
   # 設置政府新聞檢查端點 URL
   echo 'https://asia-east1-taipo-fire-suppoe.cloudfunctions.net/manualCheckGovNews' | wrangler secret put FIREBASE_FUNCTION_GOV_NEWS_URL

   # 設置 RTHK 新聞檢查端點 URL
   echo 'https://asia-east1-taipo-fire-suppoe.cloudfunctions.net/manualCheckRTHKNews' | wrangler secret put FIREBASE_FUNCTION_RTHK_NEWS_URL

   # （可選）設置 API Key（如果 Firebase Functions 需要驗證）
   wrangler secret put API_KEY
   ```

   **驗證設置**：
   ```bash
   wrangler secret list
   ```

4. 部署 Worker：
   ```bash
   npm run deploy
   ```

#### 方法 2: 使用 Cloudflare Dashboard

1. 訪問 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 選擇你的帳戶
3. 進入 Workers & Pages
4. 創建新的 Worker
5. 複製 `src/index.ts` 的內容到編輯器
6. 在 Settings > Variables 中設置環境變量：
   - `FIREBASE_FUNCTION_GOV_NEWS_URL`: 你的政府新聞檢查端點 URL
   - `FIREBASE_FUNCTION_RTHK_NEWS_URL`: 你的 RTHK 新聞檢查端點 URL
   - `API_KEY`（可選）: 用於驗證的 API Key
7. 在 Settings > Triggers 中設置 Cron Triggers：
   - `*/10 * * * *` - 每 10 分鐘執行（同時檢查政府新聞和 RTHK 新聞）
8. 保存並部署

### 4. 驗證設置

#### 測試手動觸發

```bash
# 測試政府新聞檢查
curl https://your-worker.your-subdomain.workers.dev/gov-news

# 測試 RTHK 新聞檢查
curl https://your-worker.your-subdomain.workers.dev/rthk-news

# 健康檢查
curl https://your-worker.your-subdomain.workers.dev/health
```

#### 查看日誌

```bash
# 使用 Wrangler CLI 查看實時日誌
npm run tail

# 或在 Cloudflare Dashboard 中查看
# Workers & Pages > 你的 Worker > Logs
```

## Cron 時間格式

- `*/10 * * * *` - 每 10 分鐘執行（例如：00:00, 00:10, 00:20, 00:30, 00:40, 00:50...）

## AI 分類

所有抓取的新聞都會自動使用 AI（Hugging Face Inference API）進行分類，分類類別包括：
- 事件更新
- 經濟支援
- 情緒支援
- 住宿支援
- 醫療/法律
- 重建資訊
- 統計數據
- 社區支援
- 政府公告
- 一般新聞

## 本地開發

```bash
# 啟動本地開發服務器
npm run dev

# 在另一個終端測試
curl http://localhost:8787/gov-news
curl http://localhost:8787/rthk-news
curl http://localhost:8787/health
```

## 優勢

相比 Python cron job，使用 Cloudflare Workers 的優勢：

1. **無需維護服務器**：不需要本地或遠程服務器運行 cron job
2. **全球分發**：Cloudflare 的全球網絡確保高可用性
3. **自動擴展**：無需擔心負載問題
4. **免費額度**：Cloudflare Workers 提供免費額度（每天 100,000 次請求）
5. **易於監控**：Cloudflare Dashboard 提供詳細的日誌和監控
6. **版本控制**：可以輕鬆回滾到之前的版本

## 故障排除

### Worker 沒有執行

1. 檢查 Cron Triggers 是否正確設置
2. 查看 Cloudflare Dashboard 中的日誌
3. 確認環境變量是否正確設置

### Firebase Function 調用失敗

1. 確認 Firebase Functions URL 是否正確
2. 檢查 Firebase Functions 是否需要認證（設置 API_KEY）
3. 查看 Firebase Functions 的日誌

### 查看日誌

```bash
# 使用 Wrangler CLI
npm run tail

# 或在 Cloudflare Dashboard
# Workers & Pages > 你的 Worker > Logs
```

## 移除 Python Cron Job

設置好 Cloudflare Workers 後，可以移除本地的 Python cron job：

```bash
# 查看當前的 cron jobs
crontab -l

# 編輯 crontab 並移除相關的 cron job
crontab -e

# 或移除所有 cron jobs（謹慎使用）
# crontab -r
```

## 相關文檔

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Cron Triggers 文檔](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)

