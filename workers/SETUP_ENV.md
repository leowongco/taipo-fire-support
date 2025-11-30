# Cloudflare Workers 環境變量設置指南

## 問題

如果看到以下錯誤：
```json
{"success":false,"error":"FIREBASE_FUNCTION_GOV_NEWS_URL is not set","timestamp":"..."}
{"success":false,"error":"FIREBASE_FUNCTION_RTHK_NEWS_URL is not set","timestamp":"..."}
```

這表示需要設置 Cloudflare Workers 的環境變量。

## 步驟 1: 獲取 Firebase Functions URL

### 方法 1: 從 Firebase Console 獲取

1. 訪問 [Firebase Console](https://console.firebase.google.com/)
2. 選擇你的項目（例如：`taipo-fire-suppoe`）
3. 進入 **Functions** 頁面
4. 找到以下函數：
   - `manualCheckGovNews`
   - `manualCheckRTHKNews`
5. 點擊函數名稱，查看詳細信息
6. 複製 **Trigger URL**（格式類似：`https://asia-east1-[project-id].cloudfunctions.net/manualCheckGovNews`）

### 方法 2: 使用 Firebase CLI

```bash
# 列出所有函數
firebase functions:list

# 或查看函數日誌以獲取 URL
firebase functions:log --only manualCheckGovNews
```

### 方法 3: 根據項目 ID 構建 URL

根據 `functions/src/index.ts`，區域設置為 `asia-east1`，URL 格式為：

```
https://asia-east1-[YOUR_PROJECT_ID].cloudfunctions.net/manualCheckGovNews
https://asia-east1-[YOUR_PROJECT_ID].cloudfunctions.net/manualCheckRTHKNews
```

將 `[YOUR_PROJECT_ID]` 替換為你的 Firebase 項目 ID（可在 `.firebaserc` 或 Firebase Console 中找到）。

## 步驟 2: 設置 Cloudflare Workers 環境變量

### 方法 1: 使用 Wrangler CLI（推薦）

```bash
cd workers

# 設置政府新聞檢查端點 URL
wrangler secret put FIREBASE_FUNCTION_GOV_NEWS_URL
# 當提示時，輸入你的 URL，例如：
# https://asia-east1-taipo-fire-suppoe.cloudfunctions.net/manualCheckGovNews

# 設置 RTHK 新聞檢查端點 URL
wrangler secret put FIREBASE_FUNCTION_RTHK_NEWS_URL
# 當提示時，輸入你的 URL，例如：
# https://asia-east1-taipo-fire-suppoe.cloudfunctions.net/manualCheckRTHKNews
```

### 方法 2: 使用 Cloudflare Dashboard

1. 訪問 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 選擇你的帳戶
3. 進入 **Workers & Pages**
4. 找到你的 Worker：`taipo-fire-news-fetcher`
5. 點擊進入 Worker 詳情
6. 進入 **Settings** → **Variables**
7. 在 **Environment Variables** 部分添加：
   - **Name**: `FIREBASE_FUNCTION_GOV_NEWS_URL`
     **Value**: `https://asia-east1-[YOUR_PROJECT_ID].cloudfunctions.net/manualCheckGovNews`
   - **Name**: `FIREBASE_FUNCTION_RTHK_NEWS_URL`
     **Value**: `https://asia-east1-[YOUR_PROJECT_ID].cloudfunctions.net/manualCheckRTHKNews`
8. 點擊 **Save**

## 步驟 3: 驗證設置

### 測試手動觸發

```bash
# 測試政府新聞檢查
curl https://taipo-fire-news-fetcher.lwp.workers.dev/gov-news

# 測試 RTHK 新聞檢查
curl https://taipo-fire-news-fetcher.lwp.workers.dev/rthk-news

# 健康檢查
curl https://taipo-fire-news-fetcher.lwp.workers.dev/health
```

如果設置成功，應該會看到類似以下的響應：

```json
{
  "success": true,
  "message": "政府新聞檢查完成",
  "result": {
    "success": true,
    "message": "處理完成: 新增 X 條新聞，共處理 Y 條新聞",
    "added": X,
    "total": Y
  },
  "timestamp": "2025-11-29T15:40:00.000Z"
}
```

### 查看日誌

```bash
# 使用 Wrangler CLI 查看實時日誌
cd workers
wrangler tail

# 或在 Cloudflare Dashboard 中查看
# Workers & Pages > taipo-fire-news-fetcher > Logs
```

## 故障排除

### 錯誤：Function URL 返回 404

1. 確認 Firebase Functions 已部署：
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. 確認函數名稱正確：
   - `manualCheckGovNews`（注意大小寫）
   - `manualCheckRTHKNews`（注意大小寫）

3. 確認區域正確（應該是 `asia-east1`）

### 錯誤：Function URL 返回 403 或 401

如果 Firebase Functions 需要認證，可能需要設置 `API_KEY`：

```bash
# 使用 Wrangler CLI
wrangler secret put API_KEY
# 輸入你的 API Key
```

### 確認環境變量已設置

```bash
# 使用 Wrangler CLI 查看（注意：secrets 不會顯示值，只會顯示是否已設置）
wrangler secret list
```

## 快速設置腳本

如果你知道項目 ID，可以使用以下命令快速設置：

```bash
cd workers

# 替換 YOUR_PROJECT_ID 為你的實際項目 ID
PROJECT_ID="taipo-fire-suppoe"  # 修改這裡

echo "https://asia-east1-${PROJECT_ID}.cloudfunctions.net/manualCheckGovNews" | wrangler secret put FIREBASE_FUNCTION_GOV_NEWS_URL
echo "https://asia-east1-${PROJECT_ID}.cloudfunctions.net/manualCheckRTHKNews" | wrangler secret put FIREBASE_FUNCTION_RTHK_NEWS_URL
```

## 注意事項

- 環境變量設置後，Worker 會自動使用新的配置
- 不需要重新部署 Worker（secrets 是動態的）
- 如果更改了 Firebase Functions 的 URL，需要更新這些環境變量

