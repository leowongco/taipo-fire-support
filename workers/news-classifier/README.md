# OpenRouter 新聞分類器 Cloudflare Worker

使用 OpenRouter API 的免費模型實現「黃金三角」架構的新聞分類服務。AI 會閱讀完整文章內容後進行分類，無需在本地安裝任何 Python 套件。

## 架構說明

### 黃金三角架構（避免自我偏好偏差）

本服務使用三個免費 AI 模型協作進行新聞分類：

- **選手 A**：`meta-llama/llama-3.1-8b-instruct:free`（Meta，邏輯型）
- **選手 B**：`google/gemini-2.0-flash-exp:free`（Google，速度型）
- **裁判 C**：`mistralai/mistral-7b-instruct:free`（Mistral，中立型，獨立第三方）

### 分類流程

1. **平行辯論**：Model A 和 Model B 同時對新聞進行分類
2. **共識檢查**：如果 A 和 B 達成共識，直接使用該結果
3. **獨立裁決**：如果意見分歧，呼叫 Model C 作為獨立第三方進行裁決
4. **容錯處理**：如果 Model C 失敗，優先信任 Model B（Gemini 通常更準確）

### 架構優勢

1. **避免自我偏好偏差**：Model C 作為獨立第三方，不會偏向 A 或 B
2. **提高準確度**：三模型協作過濾單一模型的幻覺
3. **完全免費**：所有模型都是免費的
4. **容錯性強**：即使部分模型失敗，系統仍能運作

## 分類類別

本服務支援以下 10 個新聞分類類別（與現有系統一致）：

- `event-update` - 事件更新（火災進展、救援情況等）
- `financial-support` - 經濟支援（資助、補助、賠償等）
- `emotional-support` - 情緒支援（心理輔導、社工服務等）
- `accommodation` - 住宿支援（庇護中心、臨時住宿等）
- `medical-legal` - 醫療/法律支援
- `reconstruction` - 重建資訊（重建進度、時間表等）
- `statistics` - 統計數據（死傷人數、失蹤人數等）
- `community-support` - 社區支援（義工、物資收集等）
- `government-announcement` - 政府公告
- `general-news` - 一般新聞

## 設置步驟

### 1. 安裝依賴

```bash
cd workers/news-classifier
npm install
```

### 2. 設置 OpenRouter API Key

使用 Wrangler CLI 設置加密的環境變數：

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

執行後，貼上你的 OpenRouter API Key（格式：`sk-or-v1-xxxxxxx`）並按 Enter。

**重要**：千萬不要把 API Key 寫在代碼裡！

### 3. 本地開發

```bash
npm run dev
```

### 4. 部署上線

```bash
npm run deploy
```

部署成功後，你會得到一個網址，例如：`https://news-classifier.your-name.workers.dev`

## API 使用

### 端點

- `POST /` - 接收新聞標題和內容，返回分類結果
- `OPTIONS /` - CORS 預檢請求

### 請求格式

```json
{
  "title": "新聞標題",
  "content": "完整的新聞文章內容（不限制長度）"
}
```

**注意**：必須同時提供 `title` 和 `content`，AI 會閱讀完整文章後進行分類。

### 響應格式

#### 共識情況（A 和 B 達成共識）

```json
{
  "category": "event-update",
  "details": "Consensus: event-update",
  "model_a": "event-update",
  "model_b": "event-update",
  "model_judge": "mistralai/mistral-7b-instruct:free",
  "judge_result": "event-update",
  "content_length": 1234
}
```

#### 意見分歧情況（需要裁判）

```json
{
  "category": "financial-support",
  "details": "Disagreement (A:event-update, B:financial-support) -> Judge C (mistralai/mistral-7b-instruct:free) decided: financial-support",
  "model_a": "event-update",
  "model_b": "financial-support",
  "model_judge": "mistralai/mistral-7b-instruct:free",
  "judge_result": "financial-support",
  "content_length": 2345
}
```

### 使用範例

#### Python 腳本中使用

```python
import requests

WORKER_URL = "https://news-classifier.your-name.workers.dev"  # 換成你的 Worker 網址

def classify_news(title, content):
    try:
        response = requests.post(
            WORKER_URL,
            json={"title": title, "content": content},
            headers={"Content-Type": "application/json"}
        )
        data = response.json()
        return data.get("category", "general-news")
    except Exception as e:
        print(f"Error: {e}")
        return "general-news"

# 測試
category = classify_news(
    "大埔社區中心急需大量毛巾",
    "大埔火災發生後，社區中心急需大量毛巾、毛毯等物資，歡迎市民捐贈..."
)
print(f"分類結果: {category}")
```

#### React 前端中使用

```typescript
const classifyNews = async (title: string, content: string) => {
  try {
    const res = await fetch("https://news-classifier.your-name.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    const data = await res.json();
    console.log("AI 判斷:", data.category);
    console.log("辯論過程:", data.details);
    return data.category;
  } catch (error) {
    console.error("分類失敗:", error);
    return "general-news";
  }
};
```

#### cURL 測試

```bash
curl -X POST https://news-classifier.your-name.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "title": "大埔火災最新情況",
    "content": "大埔火災發生後，消防處持續進行救援工作..."
  }'
```

## 重要特性

### 1. 閱讀完整文章

本服務會接收完整的 `title` 和 `content`，不截斷內容，讓 AI 能夠閱讀完整文章後進行更準確的分類。

### 2. 完全免費

所有使用的模型都標記為 `:free`，確保完全免費使用。

### 3. 容錯機制

- 如果某個免費模型返回 null 或失敗，系統會自動降級處理
- 如果 Model C（裁判）失敗，會優先信任 Model B（Gemini）的結果
- 確保即使部分模型不可用，系統仍能正常運作

### 4. CORS 支援

預設允許所有來源的 CORS 請求。在生產環境中，建議在代碼中限制允許的域名。

## 故障排除

### 錯誤：OPENROUTER_API_KEY 未設置

確保已使用 `npx wrangler secret put OPENROUTER_API_KEY` 設置 API Key。

### 錯誤：模型返回 null

這可能是因為：
1. 免費模型暫時不可用（維護中）
2. API Key 無效
3. 網絡問題

系統會自動降級處理，使用可用的模型結果。

### 分類結果不準確

- 確保傳遞了完整的文章內容（不只是標題）
- 檢查文章內容是否與分類類別相關
- 查看 `details` 字段了解辯論過程

## 相關文件

- 核心邏輯：`src/index.ts`
- 配置文件：`wrangler.toml`
- 現有系統分類器：`functions/src/aiNewsClassifier.ts`

## 授權

本專案為開源專案，使用 MIT 授權。

