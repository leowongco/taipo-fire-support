# Groq AI 設置指南

本文檔說明如何設置 Groq AI API，以實現與 Hugging Face 的雙重驗證分類功能。

## 功能說明

系統現在使用 **Hugging Face** 和 **Groq AI** 兩個 AI 服務進行**辯論比對 (Debate/Voter)** 分類：

### 核心架構

1. **選手 A (Hugging Face)**：使用 Zero-Shot 分類模型 `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`（支援中文）
   - 提供分類建議和**信心分數 (Score)**
   - 擅長抓關鍵字和概率分析

2. **選手 B (Groq)**：使用 Llama 3 模型
   - 根據語意理解給出分類
   - 擅長理解上下文和邏輯推理

3. **裁判 (Judge)**：當兩個 AI 意見分歧時，Groq 擔任裁判進行最終裁決

### 工作流程

1. **同時調用兩個服務**：對每條新聞，系統會同時調用 Hugging Face 和 Groq AI

2. **多模型嘗試機制（優先使用最便宜的模型）**：
   - **Groq AI**：會按順序嘗試多個模型，優先使用最便宜的生產模型：
     1. `llama-3.1-8b-instant` - 最便宜（$0.05/$0.08 per 1M tokens），速度 560 t/s
     2. `openai/gpt-oss-20b` - 第二便宜（$0.075/$0.30 per 1M tokens），速度 1000 t/s
     3. `llama-3.3-70b-versatile` - 更強大但更貴（$0.59/$0.79 per 1M tokens），速度 280 t/s
   - 如果某個模型已停用或不可用，自動嘗試下一個
   - **Hugging Face**：會嘗試多個模型和 API 端點：
     1. `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` - 支援中文的 Zero-Shot 模型
     2. `facebook/bart-large-mnli` - 備用模型

3. **辯論比對機制**：
   - **情況一：雙方達成共識** → 直接使用該分類
   - **情況二：意見分歧**：
     - 如果 Hugging Face 信心極高 (>0.95)，採納其意見（因為它是專門做分類的）
     - 否則，啟動**裁判模式**：讓 Groq 參考兩個助手的意見進行最終裁決

4. **容錯處理**：如果其中一個服務失敗，使用另一個服務的結果；如果兩個都失敗，使用備用分類

## 獲取 Groq API Key

1. 訪問 [Groq Console](https://console.groq.com/)
2. 註冊或登入帳號
3. 前往 "API Keys" 頁面
4. 點擊 "Create API Key" 創建新的 API Key
5. 複製 API Key（只會顯示一次，請妥善保存）

## 設置環境變量

### Firebase Functions

1. 在 Firebase Console 中，前往你的項目
2. 導航到 "Functions" > "Configuration"
3. 在 "Environment variables" 中添加：
   - **Key**: `GROQ_API_KEY`
   - **Value**: 你的 Groq API Key

或者使用 Firebase CLI：

```bash
firebase functions:config:set groq.api_key="your-groq-api-key-here"
```

### 遷移腳本（本地開發）

在項目根目錄的 `.env` 文件中添加：

```env
GROQ_API_KEY=your-groq-api-key-here
```

## 使用說明

### 自動新聞分類

當 Firebase Functions 自動抓取新聞時，會自動使用雙重驗證分類。無需額外配置。

### 遷移腳本

運行遷移腳本時，如果設置了 `GROQ_API_KEY`，會自動使用雙重驗證：

```bash
npm run migrate:announcements-to-news <email> <password>
```

## 日誌輸出示例

### 情況一：雙方達成共識

```
🤖 正在使用 AI 分類（Hugging Face + Groq 辯論比對）...
  ✓ Hugging Face 分類 (模型: MoritzLaurer/mDeBERTa-v3-base-mnli-xnli): event-update (信心度: 85.3%)
  ✓ Groq AI 分類 (模型: llama-3.1-8b-instant): event-update (估算信心度: 85.0%)
  🔹 選手 A (Hugging Face) 建議: event-update (信心度: 85.3%)
  🔸 選手 B (Groq) 建議: event-update (信心度: 85.0%)
  ✅ 雙方達成共識！使用該分類
```

### 情況二：意見分歧，啟動裁判模式

```
🤖 正在使用 AI 分類（Hugging Face + Groq 辯論比對）...
  ✓ Hugging Face 分類 (模型: MoritzLaurer/mDeBERTa-v3-base-mnli-xnli): event-update (信心度: 75.2%)
  ✓ Groq AI 分類 (模型: llama-3.1-8b-instant): financial-support (估算信心度: 82.0%)
  🔹 選手 A (Hugging Face) 建議: event-update (信心度: 75.2%)
  🔸 選手 B (Groq) 建議: financial-support (信心度: 82.0%)
  ⚠️ 意見分歧！啟動裁判模式...
  ⚖️ 最終裁決 (模型: llama-3.1-8b-instant): event-update
```

### 情況三：Hugging Face 信心極高

```
🤖 正在使用 AI 分類（Hugging Face + Groq 辯論比對）...
  ✓ Hugging Face 分類 (模型: MoritzLaurer/mDeBERTa-v3-base-mnli-xnli): statistics (信心度: 96.5%)
  ✓ Groq AI 分類 (模型: llama-3.1-8b-instant): event-update (估算信心度: 85.0%)
  🔹 選手 A (Hugging Face) 建議: statistics (信心度: 96.5%)
  🔸 選手 B (Groq) 建議: event-update (信心度: 85.0%)
  ⚠️ 意見分歧！啟動裁判模式...
  ⚖️ 裁判判定: Hugging Face 信心極高 (96.5%)，採納其意見。
```

## 注意事項

1. **API Key 安全**：請勿將 API Key 提交到版本控制系統（Git）
2. **費用**：Groq 提供免費額度，但請注意使用量
3. **速率限制**：Groq API 有速率限制，系統已添加適當的延遲
4. **可選功能**：如果未設置 `GROQ_API_KEY`，系統會自動回退到僅使用 Hugging Face
5. **模型自動切換**：如果某個 Groq 模型被停用，系統會自動嘗試其他可用模型，無需手動配置
6. **模型優先級（成本優化）**：系統會優先使用最便宜的生產模型（`llama-3.1-8b-instant`），以最大化免費額度的使用。如果該模型不可用，會按成本從低到高嘗試其他模型
7. **免費額度**：Groq 提供免費額度，所有模型在免費額度內都可以免費使用。優先使用最便宜的模型可以讓你在免費額度內處理更多請求

## 故障排除

### Groq API Key 未設置

如果看到以下警告：
```
⚠️ Groq API Key 未設置，跳過 Groq 分類
```

這表示系統將僅使用 Hugging Face 進行分類，功能仍然正常，只是沒有雙重驗證。

### API 錯誤

如果 Groq API 返回錯誤，系統會自動使用 Hugging Face 的結果，不會中斷分類過程。

## 相關文件

- `functions/src/aiNewsClassifier.ts` - AI 分類器實現
- `src/scripts/migrate-announcements-to-news.ts` - 遷移腳本

