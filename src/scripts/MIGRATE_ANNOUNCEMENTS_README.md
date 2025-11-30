# 公告遷移到新聞集合腳本

## 功能說明

此腳本會將 `announcements` 集合中的數據遷移到 `news` 集合，並使用 AI 自動進行分類。

### 主要功能

1. **讀取公告**：從 `announcements` 集合讀取所有公告
2. **AI 分類**：使用 Hugging Face Inference API 對每條公告進行自動分類
3. **數據遷移**：將公告數據轉換為新聞格式並寫入 `news` 集合
4. **去重處理**：檢查是否已存在相同標題或 URL 的新聞，避免重複
5. **可選刪除**：可選擇在遷移後刪除原公告

## 使用方法

### 基本使用（保留原公告）

```bash
npm run migrate:announcements-to-news <email> <password>
```

### 遷移後刪除原公告

```bash
npm run migrate:announcements-to-news <email> <password> --delete
```

### 使用環境變量

你也可以在 `.env` 文件中設置管理員帳號和密碼：

```env
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-password
```

然後直接運行：

```bash
npm run migrate:announcements-to-news
# 或
npm run migrate:announcements-to-news --delete
```

## 執行流程

1. **認證**：使用管理員帳號登入 Firebase
2. **讀取公告**：從 `announcements` 集合讀取所有公告（按時間倒序）
3. **處理每條公告**：
   - 檢查是否已存在相同的新聞（根據標題或 URL）
   - 如果已存在，跳過
   - 如果不存在，使用 AI 進行分類
   - 根據來源設置標籤（`gov` 或 `news`）
   - 創建新聞文檔並寫入 `news` 集合
   - 如果使用 `--delete` 參數，刪除原公告
4. **顯示統計**：顯示遷移結果統計

## AI 分類類別

腳本會自動將公告分類到以下 10 個類別之一：

- **event-update** - 事件更新
- **financial-support** - 經濟支援
- **emotional-support** - 情緒支援
- **accommodation** - 住宿支援
- **medical-legal** - 醫療/法律
- **reconstruction** - 重建資訊
- **statistics** - 統計數據
- **community-support** - 社區支援
- **government-announcement** - 政府公告
- **general-news** - 一般新聞

## 注意事項

1. **AI 分類時間**：每條公告需要調用 AI API，可能需要幾秒鐘時間
2. **請求限制**：腳本在每條記錄之間添加了 1 秒延遲，避免請求過快
3. **備用分類**：如果 AI 分類失敗，會自動使用關鍵詞匹配進行備用分類
4. **數據保留**：默認情況下，原公告會保留在 `announcements` 集合中
5. **權限要求**：需要管理員權限才能執行此腳本

## 輸出示例

```
📋 使用 Firebase 項目: taipo-fire-suppoe
✅ 已登入: admin@example.com

📰 開始遷移公告到新聞集合...

📋 找到 5 條公告

處理公告: 大埔火災最新情況
  🤖 正在使用 AI 分類...
  ✓ AI 分類: event-update (信心度: 85.3%)
  ✅ 已遷移到新聞集合 (分類: event-update)

處理公告: 政府提供經濟援助
  🤖 正在使用 AI 分類...
  ✓ AI 分類: financial-support (信心度: 92.1%)
  ✅ 已遷移到新聞集合 (分類: financial-support)

...

==================================================
📊 遷移完成統計：
  ✅ 成功遷移: 5 條
  ⏭️  跳過（已存在）: 0 條
  ❌ 失敗: 0 條
  📋 總計: 5 條
==================================================

✅ 遷移完成！
```

## 故障排除

### 錯誤：登入失敗

確保提供正確的管理員帳號和密碼，或檢查 `.env` 文件中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`。

### 錯誤：權限不足

確保使用的帳號具有 Firestore 的寫入權限。

### AI 分類失敗

如果 AI 分類失敗，腳本會自動使用備用分類方法（關鍵詞匹配），不會中斷遷移過程。

### 遷移速度慢

這是正常的，因為每條記錄都需要：
1. 調用 AI API 進行分類（可能需要幾秒）
2. 寫入 Firestore
3. 1 秒延遲避免請求過快

## 相關文件

- 腳本位置：`src/scripts/migrate-announcements-to-news.ts`
- AI 分類器：`functions/src/aiNewsClassifier.ts`

