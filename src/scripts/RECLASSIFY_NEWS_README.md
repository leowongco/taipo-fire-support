# 使用 OpenRouter Worker 重新分類新聞腳本

此腳本會讀取 Firestore 數據庫中的所有新聞，檢查是否與火災相關，並使用 OpenRouter Worker API 進行重新分類。

## 功能說明

1. **讀取新聞**：從 Firestore `news` 集合讀取所有新聞（按時間倒序）
2. **篩選相關新聞**：檢查每條新聞是否與火災相關
   - 如果與火災無關，**自動刪除**該新聞
   - 如果與火災相關，繼續處理
3. **AI 重新分類**：使用 OpenRouter Worker（黃金三角架構）對相關新聞進行重新分類
4. **更新數據庫**：如果分類結果與現有分類不同，更新 Firestore 中的 `category` 字段
5. **統計報告**：顯示處理結果統計（包括刪除的新聞數量）

## 使用方法

### 基本使用

```bash
npm run reclassify:news-openrouter
```

### 環境變量設置

在 `.env` 文件中設置以下環境變量：

```env
# Firebase 配置（必需）
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# 管理員帳號（必需）
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password

# OpenRouter Worker URL（必需）
# 獲取方法：
# 1. 前往 Cloudflare Dashboard: https://dash.cloudflare.com
# 2. 選擇 Workers & Pages
# 3. 找到 "news-classifier" Worker
# 4. 複製 Worker URL（格式：https://news-classifier.<your-subdomain>.workers.dev）
# 例如：https://news-classifier.lwp.workers.dev
OPENROUTER_WORKER_URL=https://news-classifier.lwp.workers.dev
# 或使用
VITE_OPENROUTER_WORKER_URL=https://news-classifier.lwp.workers.dev
```

### 如何獲取 Worker URL

如果 Worker 已經部署，可以通過以下方式獲取 URL：

1. **從 Cloudflare Dashboard**：
   - 前往 https://dash.cloudflare.com
   - 選擇 "Workers & Pages"
   - 找到 "news-classifier" Worker
   - 點擊進入，URL 會顯示在頁面上

2. **從命令行**：
   ```bash
   cd workers/news-classifier
   npx wrangler deployments list
   ```

3. **推測 URL**（如果知道你的 Cloudflare 帳號子域名）：
   - 格式：`https://news-classifier.<your-subdomain>.workers.dev`
   - 例如：`https://news-classifier.lwp.workers.dev`

### 如果 Worker 尚未部署

如果 Worker 尚未部署，請先執行以下步驟：

```bash
cd workers/news-classifier
npm install
npx wrangler secret put OPENROUTER_API_KEY  # 設置 OpenRouter API Key
npx wrangler deploy
```

部署成功後，會顯示 Worker URL，將其添加到 `.env` 文件中。

## 執行流程

1. **認證**：使用管理員帳號登入 Firebase
2. **讀取新聞**：從 `news` 集合讀取所有新聞（按時間倒序）
3. **處理每條新聞**：
   - 檢查新聞是否有標題和內容
   - 如果內容太短（少於 50 字元），跳過
   - **檢查是否與火災相關**：
     - 使用關鍵詞匹配判斷（包含火災、宏福苑、大埔、救援等關鍵詞）
     - 如果與火災無關，**刪除該新聞**並跳過後續處理
     - 如果與火災相關，繼續處理
   - 調用 OpenRouter Worker API 進行分類
   - 如果新分類與現有分類相同，跳過更新
   - 如果不同，更新 Firestore 中的 `category` 字段
   - 記錄重新分類的時間和來源
4. **顯示統計**：顯示處理結果統計（包括刪除的新聞數量）

## 注意事項

1. **執行時間**：每條新聞需要調用 OpenRouter Worker API，可能需要幾秒鐘時間。腳本在每條記錄之間添加了 1 秒延遲，避免請求過快。

2. **API 限制**：確保 OpenRouter Worker 已正確部署並可訪問。

3. **數據完整性**：
   - 只處理有標題和內容的新聞
   - 內容少於 50 字元的新聞會被跳過
   - 如果分類失敗，會跳過該新聞並記錄錯誤

4. **篩選機制**：
   - 使用關鍵詞匹配判斷新聞是否與火災相關
   - 關鍵詞包括：火災、火警、宏福苑、大埔、救援、消防、傷亡、庇護中心等
   - **與火災無關的新聞會被永久刪除**，請謹慎使用

5. **更新記錄**：更新時會記錄：
   - `category`: 新的分類結果
   - `reclassifiedAt`: 重新分類的時間（ISO 格式）
   - `reclassifiedBy`: 重新分類的來源（固定為 'openrouter-worker'）

6. **權限要求**：需要管理員權限才能執行此腳本。

7. **刪除操作**：刪除操作是永久性的，無法恢復。建議在執行前先備份數據。

## 輸出示例

```
📋 使用 Firebase 項目: taipo-fire-suppoe
🔗 OpenRouter Worker URL: https://news-classifier.your-name.workers.dev

🔐 正在登入管理員帳號...
✅ 登入成功

📰 找到 150 條新聞，開始重新分類...

[1/150] 📄 處理: 大埔火災最新情況...
   當前分類: general-news
   內容長度: 1234 字元
   🔍 正在檢查是否與火災相關...
   ✅ 確認與火災相關
   🤖 正在使用 OpenRouter AI 分類...
   ✅ AI 分類結果: event-update
   📊 辯論過程: Consensus: event-update
   ✅ 已更新分類: general-news → event-update

[2/150] 📄 處理: 政府提供經濟援助...
   當前分類: financial-support
   內容長度: 856 字元
   🔍 正在檢查是否與火災相關...
   ✅ 確認與火災相關
   🤖 正在使用 OpenRouter AI 分類...
   ✅ AI 分類結果: financial-support
   📊 辯論過程: Consensus: financial-support
   ⏭️  分類未改變，跳過更新

[3/150] 📄 處理: 其他無關新聞...
   當前分類: general-news
   內容長度: 500 字元
   🔍 正在檢查是否與火災相關...
   ❌ 新聞與火災無關，將刪除
   🗑️  已刪除新聞: 其他無關新聞...

...

==================================================
📊 重新分類完成統計：
  ✅ 成功更新: 45 條
  ⏭️  跳過（無變化）: 95 條
  ⏭️  跳過（數據不完整）: 5 條
  🗑️  已刪除（與火災無關）: 3 條
  ❌ 失敗: 2 條
  📋 總計: 150 條
==================================================
```

## 故障排除

### 錯誤：OPENROUTER_WORKER_URL 未設置

確保在 `.env` 文件中設置了 `OPENROUTER_WORKER_URL` 或 `VITE_OPENROUTER_WORKER_URL`。

### 錯誤：登入失敗

確保提供正確的管理員帳號和密碼，或檢查 `.env` 文件中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`。

### 錯誤：權限不足

確保使用的帳號具有 Firestore 的寫入權限。

### 分類失敗

如果 OpenRouter Worker API 返回錯誤：
- 檢查 Worker 是否已正確部署
- 檢查 Worker URL 是否正確
- 檢查網絡連接
- 查看錯誤訊息了解具體原因

### 執行速度慢

這是正常的，因為：
1. 每條記錄都需要調用 OpenRouter Worker API（可能需要幾秒）
2. 腳本在每條記錄之間添加了 1 秒延遲，避免請求過快
3. 如果有很多新聞，整個過程可能需要較長時間

## 相關文件

- 腳本位置：`src/scripts/reclassify-news-with-openrouter.ts`
- OpenRouter Worker：`workers/news-classifier/`
- 現有分類器：`functions/src/aiNewsClassifier.ts`

