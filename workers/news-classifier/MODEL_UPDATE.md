# 模型更新說明

## 問題

在使用 OpenRouter Worker 時遇到以下錯誤：

1. **404 錯誤**：多個免費模型不可用
   - `meta-llama/llama-3.1-8b-instruct:free` 不可用
   - `google/gemini-flash-1.5:free` 不可用
   - `qwen/qwen-2.5-7b-instruct:free` 不可用
2. **429 錯誤**：免費模型觸發速率限制

## 解決方案

### 1. 使用 OpenRouter 備用模型機制

已實現 OpenRouter 的 `models` 參數，自動選擇第一個可用的模型。

參考：[OpenRouter 免費模型列表](https://openrouter.ai/models?max_price=0)

- **MODEL_A_OPTIONS**（按優先順序）：
  1. `mistralai/mistral-7b-instruct:free` - Mistral 7B，穩定且邏輯性強（確認可用）
  2. `meta-llama/llama-3.2-3b-instruct:free` - Meta Llama 3.2 3B，備用
  3. `nousresearch/nous-hermes-3:free` - Nous Hermes 3，備用（如果可用）

- **MODEL_B_OPTIONS**（按優先順序）：
  1. `meta-llama/llama-3.2-3b-instruct:free` - Meta Llama 3.2 3B，速度快
  2. `mistralai/mistral-7b-instruct:free` - Mistral 7B，備用
  3. `nousresearch/nous-hermes-3:free` - Nous Hermes 3，備用（如果可用）

- **MODEL_C_OPTIONS**（按優先順序，獨立第三方）：
  1. `nousresearch/nous-hermes-3:free` - Nous Hermes 3，中立型（如果可用）
  2. `meta-llama/llama-3.2-3b-instruct:free` - Meta Llama 3.2 3B，備用
  3. `mistralai/mistral-7b-instruct:free` - Mistral 7B，備用

### 2. 智能模型選擇

- 使用 OpenRouter 的 `models` 參數，自動選擇第一個可用的模型
- 如果主模型不可用（404），自動切換到下一個備用模型
- 如果遇到速率限制（429），會重試並在必要時切換模型
- 添加了詳細的日誌，記錄實際使用的模型

### 3. 重試和降級邏輯

- 每個模型最多重試 1 次（避免過度重試）
- 如果一個模型失敗，自動嘗試列表中的下一個模型
- 指數退避策略處理速率限制
- 如果所有模型都失敗，優雅降級處理

## 部署

更新後需要重新部署 Worker：

```bash
cd workers/news-classifier
npm run deploy
```

## 備用模型

如果主模型仍然不可用，可以在代碼中使用以下備用模型：

- `microsoft/phi-3-mini-128k-instruct:free`
- `google/gemini-flash-1.5:free`
- `mistralai/mistral-7b-instruct:free`

## 注意事項

1. 免費模型有速率限制（通常每分鐘 16 次請求）
2. 如果請求頻率過高，建議：
   - 增加請求之間的延遲
   - 考慮使用付費模型
   - 實現請求隊列和限流機制

3. 模型可用性可能會變化，如果遇到 404 錯誤，請檢查 OpenRouter 的模型列表

## 測試

部署後可以通過以下方式測試：

```bash
curl -X POST https://news-classifier.lwp.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "title": "測試標題",
    "content": "測試內容"
  }'
```

