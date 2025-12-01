# OpenRouter Worker 分類器設置

Firebase Functions 中的新聞獲取器（政府新聞、RTHK 新聞、Google News）現在使用 OpenRouter Worker 進行分類。

## 環境變量設置

### ✅ 好消息：已設置默認值，無需額外配置！

代碼中已經設置了默認值 `https://news-classifier.lwp.workers.dev`，如果這個 URL 正確，**直接部署即可使用，無需額外設置環境變量**。

### 如果需要更改 URL，可以使用以下方法：

#### 方法 1: 在 Google Cloud Console 中設置（推薦）

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 選擇你的項目
3. 進入 **"Cloud Functions"**（不是 Firebase Console）
4. 找到你的函數（例如 `fetchAndAddGovNews`、`fetchAndAddRTHKNews` 等）
5. 點擊函數名稱進入詳情頁
6. 點擊 **"EDIT"** 按鈕
7. 展開 **"Runtime, build, connections and security settings"**
8. 在 **"Runtime environment variables"** 部分：
   - 點擊 **"ADD VARIABLE"**
   - Key: `OPENROUTER_WORKER_URL`
   - Value: `https://news-classifier.lwp.workers.dev`（或你的 Worker URL）
9. 點擊 **"DEPLOY"** 保存更改

#### 方法 2: 使用 gcloud CLI

```bash
# 獲取項目 ID
PROJECT_ID=$(firebase use | grep -oP '(?<=\[default\] ).*')

# 設置環境變量（需要先部署一次函數才能設置）
# 替換 <function-name> 為實際的函數名稱，例如 fetchAndAddGovNews
gcloud functions deploy <function-name> \
  --gen2 \
  --runtime=nodejs24 \
  --region=asia-east1 \
  --source=lib \
  --entry-point=<function-name> \
  --set-env-vars OPENROUTER_WORKER_URL=https://news-classifier.lwp.workers.dev \
  --project=$PROJECT_ID
```

#### 方法 3: 修改代碼中的默認值

如果默認 URL 需要更改，可以直接修改 `functions/src/openRouterClassifier.ts` 中的默認值：

```typescript
const openRouterWorkerUrl = defineString("OPENROUTER_WORKER_URL", {
  default: "https://your-new-worker-url.workers.dev", // 修改這裡
  description: "OpenRouter Worker URL for news classification",
});
```

然後重新構建和部署：

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 已更新的文件

以下文件已更新為使用 OpenRouter Worker：

1. `functions/src/govNewsFetcher.ts` - 政府新聞獲取器
2. `functions/src/rthkNewsFetcher.ts` - RTHK 新聞獲取器
3. `functions/src/googleNewsFetcher.ts` - Google News 獲取器
4. `functions/src/index.ts` - 重新分類端點

## 備用機制

如果 OpenRouter Worker 不可用或未設置環境變量，系統會自動使用關鍵詞匹配進行備用分類，確保系統穩定運作。

## 部署

設置環境變量後，重新部署 Firebase Functions：

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 驗證

部署後，可以通過以下方式驗證：

1. 手動觸發新聞獲取：
   ```bash
   curl https://asia-east1-<project-id>.cloudfunctions.net/manualCheckGovNews
   ```

2. 檢查 Firebase Functions 日誌：
   ```bash
   firebase functions:log
   ```

3. 查看日誌中是否有 "開始使用 OpenRouter Worker 進行分類..." 的訊息

## 注意事項

- 確保 OpenRouter Worker 已正確部署並可訪問
- 確保 OpenRouter Worker 已設置 `OPENROUTER_API_KEY`
- 如果 Worker 不可用，系統會自動降級到關鍵詞匹配分類

