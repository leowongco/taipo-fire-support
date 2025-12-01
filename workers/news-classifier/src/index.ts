/**
 * OpenRouter 新聞分類器 Cloudflare Worker
 * 使用黃金三角架構（A、B 辯論，C 獨立裁判）進行新聞分類
 * 所有模型均為免費模型
 */

export interface Env {
  OPENROUTER_API_KEY: string; // 在 Cloudflare Dashboard 或使用 wrangler secret 設置
}

// 10 個新聞分類類別（與現有系統一致）
export type NewsCategory =
  | "event-update" // 事件更新
  | "financial-support" // 經濟支援
  | "emotional-support" // 情緒支援
  | "accommodation" // 住宿支援
  | "medical-legal" // 醫療/法律支援
  | "reconstruction" // 重建資訊
  | "statistics" // 統計數據
  | "community-support" // 社區支援
  | "government-announcement" // 政府公告
  | "general-news"; // 一般新聞

const LABELS: NewsCategory[] = [
  "event-update",
  "financial-support",
  "emotional-support",
  "accommodation",
  "medical-legal",
  "reconstruction",
  "statistics",
  "community-support",
  "government-announcement",
  "general-news",
];

// 分類描述（用於 AI 理解）
const CATEGORY_DESCRIPTIONS: Record<NewsCategory, string> = {
  "event-update":
    "事件更新：關於火災進展、救援情況、現場狀況、火勢控制等即時事件資訊",
  "financial-support":
    "經濟支援：資助、補助、津貼、賠償、基金、捐款、財政援助、現金援助等",
  "emotional-support":
    "情緒支援：心理輔導、社工服務、情緒支援熱線、創傷治療、哀傷輔導等",
  accommodation:
    "住宿支援：庇護中心、臨時住宿、過渡性房屋、休息站、社區會堂等",
  "medical-legal":
    "醫療/法律支援：醫療服務、法律諮詢、法律援助、醫療站、義診等",
  reconstruction:
    "重建資訊：重建進度、重建時間表、重建資源、重建計劃、恢復工作等",
  statistics:
    "統計數據：死傷人數、失蹤人數、受傷人數、事件統計、數據更新等",
  "community-support":
    "社區支援：義工服務、物資收集、社區活動、民間組織支援、志願服務等",
  "government-announcement":
    "政府公告：政府部門發布的正式公告、政策、措施、安排等",
  "general-news": "一般新聞：其他與事件相關但無法歸類到上述類別的新聞",
};

// 黃金三角架構：三個免費模型
// 注意：使用 OpenRouter 的備用模型機制，如果主模型不可用會自動切換
// 模型列表按優先順序排列，OpenRouter 會自動選擇第一個可用的模型
// 參考：https://openrouter.ai/models?max_price=0

// 選手 A 的模型列表（按優先順序）
const MODEL_A_OPTIONS = [
  "mistralai/mistral-7b-instruct:free", // 優先：Mistral 7B，穩定且邏輯性強（確認可用）
  "meta-llama/llama-3.2-3b-instruct:free", // 備用：Meta Llama 3.2 3B
  "nousresearch/nous-hermes-3:free", // 備用：Nous Hermes 3（如果可用）
];

// 選手 B 的模型列表（按優先順序）
const MODEL_B_OPTIONS = [
  "meta-llama/llama-3.2-3b-instruct:free", // 優先：Meta Llama 3.2 3B，速度快
  "mistralai/mistral-7b-instruct:free", // 備用：Mistral 7B
  "nousresearch/nous-hermes-3:free", // 備用：Nous Hermes 3（如果可用）
];

// 裁判 C 的模型列表（按優先順序，必須與 A 和 B 不同）
const MODEL_C_OPTIONS = [
  "nousresearch/nous-hermes-3:free", // 優先：Nous Hermes 3，中立型（如果可用）
  "meta-llama/llama-3.2-3b-instruct:free", // 備用：Meta Llama 3.2 3B
  "mistralai/mistral-7b-instruct:free", // 備用：Mistral 7B
];

/**
 * 延遲函數（用於處理速率限制）
 * @param ms 延遲毫秒數
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 呼叫 OpenRouter API（使用備用模型機制）
 * @param modelOptions 模型選項列表（按優先順序）
 * @param prompt 提示詞
 * @param apiKey API Key
 * @param retries 每個模型的重試次數（默認 1 次）
 * @returns 模型回應內容，如果所有模型都失敗則返回 null
 */
async function callOpenRouter(
  modelOptions: string[],
  prompt: string,
  apiKey: string,
  retries: number = 1
): Promise<string | null> {
  // 嘗試每個模型選項
  for (const model of modelOptions) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 如果不是第一次嘗試，添加延遲以避免速率限制
        if (attempt > 0) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指數退避，最多 5 秒
          console.log(`Retrying ${model} after ${delayMs}ms (attempt ${attempt + 1}/${retries + 1})`);
          await delay(delayMs);
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://taipo-fire-support.web.app",
            "X-Title": "Tai Po Fire Support",
          },
          body: JSON.stringify({
            model: model, // 主模型
            models: modelOptions, // 備用模型列表（OpenRouter 會自動選擇第一個可用的）
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1, // 低溫確保穩定
          }),
        });

        const data: any = await response.json();

        // 處理速率限制（429）
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.warn(`Rate limit hit for ${model}, waiting ${waitTime}ms`);
          
          if (attempt < retries) {
            await delay(waitTime);
            continue; // 重試同一個模型
          } else {
            // 這個模型重試失敗，嘗試下一個模型
            console.warn(`Model ${model} rate limited, trying next model...`);
            break; // 跳出重試循環，嘗試下一個模型
          }
        }

        // 處理模型不可用（404）
        if (response.status === 404) {
          console.warn(`Model ${model} not found (404), trying next model...`);
          break; // 跳出重試循環，嘗試下一個模型
        }

        if (!response.ok || !data.choices || data.choices.length === 0) {
          // 其他錯誤
          if (attempt === retries) {
            console.warn(`Model ${model} failed, trying next model...`);
            break; // 跳出重試循環，嘗試下一個模型
          }
          continue; // 重試同一個模型
        }

        // 成功
        const usedModel = data.model || model;
        console.log(`✅ Successfully used model: ${usedModel}`);
        return data.choices[0].message.content.trim();
      } catch (error: any) {
        if (attempt === retries) {
          console.warn(`Error calling model ${model}, trying next model...`);
          break; // 跳出重試循環，嘗試下一個模型
        }
        // 繼續重試同一個模型
      }
    }
  }

  // 所有模型都失敗了
  console.error(`All models failed: ${modelOptions.join(", ")}`);
  return null;
}

/**
 * 清洗分類結果，確保返回有效的分類類別
 * @param result 模型返回的原始結果
 * @returns 有效的分類類別，如果無效則返回 "general-news"
 */
function cleanCategory(result: string | null): NewsCategory {
  if (!result) {
    return "general-news";
  }

  // 嘗試精確匹配
  const exactMatch = LABELS.find(
    (label) => label.toLowerCase() === result.toLowerCase()
  );
  if (exactMatch) {
    return exactMatch;
  }

  // 嘗試部分匹配（如果結果包含分類名稱）
  const partialMatch = LABELS.find((label) =>
    result.toLowerCase().includes(label.toLowerCase())
  );
  if (partialMatch) {
    return partialMatch;
  }

  // 如果都不匹配，返回默認分類
  return "general-news";
}

/**
 * 構建分類提示詞
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 分類提示詞
 */
function buildClassifyPrompt(title: string, content: string): string {
  const fullText = `${title}\n\n${content}`;
  const labelsList = LABELS.join("、");
  const labelsDescriptions = LABELS.map(
    (label) => `- ${label}: ${CATEGORY_DESCRIPTIONS[label]}`
  ).join("\n");

  return `你是一個嚴謹的新聞分類員。請仔細閱讀以下完整文章內容，然後將其分類為以下其中一類：

可選分類：
${labelsDescriptions}

新聞標題：${title}

新聞內容：${fullText}

規則：
1. 請仔細閱讀完整文章內容後再進行分類
2. 只回答分類名稱（例如：event-update），不要有任何解釋
3. 必須從上述列表中選擇一個分類
4. 若無法判斷請回 "general-news"`;
}

/**
 * 構建裁判提示詞
 * @param title 新聞標題
 * @param content 新聞內容
 * @param resultA 選手 A 的分類結果
 * @param resultB 選手 B 的分類結果
 * @returns 裁判提示詞
 */
function buildJudgePrompt(
  title: string,
  content: string,
  resultA: NewsCategory,
  resultB: NewsCategory
): string {
  const fullText = `${title}\n\n${content}`;
  const labelsList = LABELS.join("、");
  const labelsDescriptions = LABELS.map(
    (label) => `- ${label}: ${CATEGORY_DESCRIPTIONS[label]}`
  ).join("\n");

  return `你是資深新聞編輯。兩位助手對這則新聞的分類有分歧，請你作為獨立第三方進行裁決。

可選分類：
${labelsDescriptions}

新聞標題：${title}

新聞內容：${fullText}

助手 A (Gemini Flash) 認為：${resultA}
助手 B (Mistral) 認為：${resultB}

請仔細閱讀完整文章內容，考慮哪個分類更準確。請選出最準確的一個分類名稱。

規則：
1. 只回答分類名稱（例如：event-update），不要有任何解釋
2. 必須從上述列表中選擇一個分類
3. 請客觀公正地判斷，不要偏向任何一方`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 處理 CORS 預檢請求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 只允許 POST 請求
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    // 檢查 API Key 是否設置
    if (!env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      // 解析請求體
      const body = await request.json() as { title?: string; content?: string };
      const { title, content } = body;

      // 驗證必要參數
      if (!title || !content) {
        return new Response(
          JSON.stringify({ error: "Missing 'title' or 'content' field" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // 記錄內容長度（用於調試）
      const contentLength = (title + content).length;
      console.log(`Processing classification for content length: ${contentLength}`);

      // 構建分類提示詞
      const classifyPrompt = buildClassifyPrompt(title, content);

      // 1. A 與 B 平行辯論（Promise.all 加快速度）
      // 注意：為了避免速率限制，添加小延遲
      const [resultA, resultB] = await Promise.all([
        callOpenRouter(MODEL_A_OPTIONS, classifyPrompt, env.OPENROUTER_API_KEY),
        // 添加小延遲以避免同時觸發速率限制
        delay(300).then(() => callOpenRouter(MODEL_B_OPTIONS, classifyPrompt, env.OPENROUTER_API_KEY)),
      ]);

      // 清洗結果
      const cleanA = cleanCategory(resultA);
      const cleanB = cleanCategory(resultB);

      let finalVerdict: NewsCategory = cleanA;
      let logic = `Consensus: ${cleanA}`;
      let judgeResult: NewsCategory | null = null;

      // 2. 判斷共識
      if (cleanA !== cleanB) {
        // 意見分歧 -> 呼叫 MODEL_C (Mistral) 來當裁判
        console.log(
          `Disagreement detected: A=${cleanA}, B=${cleanB}, calling judge...`
        );

        const judgePrompt = buildJudgePrompt(title, content, cleanA, cleanB);
        const resultC = await callOpenRouter(
          MODEL_C_OPTIONS,
          judgePrompt,
          env.OPENROUTER_API_KEY
        );

        // 如果裁判掛了(null) 或亂講話，我們優先信任 Google Gemini (MODEL_B) 通常比較聰明
        judgeResult = cleanCategory(resultC);
        if (judgeResult === "general-news" && resultC === null) {
          // 如果裁判完全失敗，使用 Model B 的結果
          judgeResult = cleanB;
          logic = `Disagreement (A:${cleanA}, B:${cleanB}) -> Judge C failed, using Model B: ${cleanB}`;
        } else {
          logic = `Disagreement (A:${cleanA}, B:${cleanB}) -> Judge C decided: ${judgeResult}`;
        }

        finalVerdict = judgeResult;
      }

      // 3. 回傳結果
      return new Response(
        JSON.stringify({
          category: finalVerdict,
          details: logic,
          model_a: cleanA,
          model_b: cleanB,
          model_judge: "C",
          judge_result: judgeResult || cleanA, // 如果沒有分歧，顯示 A 的結果
          content_length: contentLength,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error: any) {
      console.error("Classification error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Internal server error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};

