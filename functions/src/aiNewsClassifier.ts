/**
 * 使用 AI 進行新聞分類
 * 使用 Hugging Face Inference API 和 Groq AI 進行雙重驗證
 */

import * as logger from "firebase-functions/logger";

// AI 分類結果接口
interface ClassificationResult {
  category: NewsCategory;
  confidence: number;
  source: "huggingface" | "groq" | "fallback";
}

// 新聞分類類型
export type NewsCategory =
  | "event-update" // 事件更新（火災進展、救援情況等）
  | "financial-support" // 經濟支援（資助、補助、賠償等）
  | "emotional-support" // 情緒支援（心理輔導、社工服務等）
  | "accommodation" // 住宿支援（庇護中心、臨時住宿等）
  | "medical-legal" // 醫療/法律支援
  | "reconstruction" // 重建資訊（重建進度、時間表等）
  | "statistics" // 統計數據（死傷人數、失蹤人數等）
  | "community-support" // 社區支援（義工、物資收集等）
  | "government-announcement" // 政府公告
  | "investigation" // 調查（刑事調查、貪污調查、事故調查等）
  | "general-news"; // 一般新聞

// 分類描述（用於 AI 理解）
const CATEGORY_DESCRIPTIONS = {
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
  investigation:
    "調查：刑事調查、貪污調查、事故調查、火災原因調查、責任調查、執法部門調查等",
  "general-news": "一般新聞：其他與事件相關但無法歸類到上述類別的新聞",
};

/**
 * 使用 Groq AI 進行新聞分類（選手 B）
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 分類結果
 */
async function classifyWithGroq(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      logger.warn("Groq API Key 未設置，跳過 Groq 分類");
      return null;
    }

    const text = `${title}\n\n${content}`.substring(0, 2000); // Groq 可以處理更長的文本
    
    // 構建分類標籤列表（與 Hugging Face 使用相同的標籤）
    const labels = Object.keys(CATEGORY_DESCRIPTIONS);
    const labelsList = labels.join("、");

    const prompt = `你是一個嚴謹的新聞分類員。請閱讀以下內容，並將其分類為以下其中一類：

${labelsList}

新聞標題：${title}

新聞內容：${text}

規則：
1. 只回答分類名稱（例如：event-update），不要有任何解釋。
2. 必須從上述列表中選擇。`;

    // 嘗試多個可用的模型（按優先級，優先使用最便宜的生產模型）
    // 價格參考：llama-3.1-8b-instant ($0.05/$0.08) < gpt-oss-20b ($0.075/$0.30) < llama-3.3-70b ($0.59/$0.79)
    const models = [
      "llama-3.1-8b-instant", // 最便宜：$0.05/$0.08 per 1M tokens，速度 560 t/s
      "openai/gpt-oss-20b", // 第二便宜：$0.075/$0.30 per 1M tokens，速度 1000 t/s
      "llama-3.3-70b-versatile", // 更強大但更貴：$0.59/$0.79 per 1M tokens，速度 280 t/s
      "openai/gpt-oss-120b", // 最強大但最貴：$0.15/$0.60 per 1M tokens，速度 500 t/s
    ];

    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: "你是一個專業的新聞分類助手，請準確地將新聞分類到指定的類別。",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3, // 降低溫度以提高一致性
            max_tokens: 50,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // 如果是模型停用錯誤，嘗試下一個模型
          if (errorData.error?.code === "model_decommissioned" || response.status === 400) {
            logger.warn(`模型 ${model} 不可用，嘗試下一個模型...`);
            lastError = new Error(`模型 ${model} 已停用`);
            continue;
          }
          const errorText = await response.text();
          throw new Error(`Groq API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const categoryText = result.choices?.[0]?.message?.content?.trim().toLowerCase();

        if (!categoryText) {
          throw new Error("Groq API 返回空結果");
        }

        // 驗證返回的分類是否有效
        const category = labels.find(
          (label) => label.toLowerCase() === categoryText || categoryText.includes(label.toLowerCase())
        ) as NewsCategory | undefined;

        if (!category) {
          logger.warn(`Groq 返回無效分類: ${categoryText}`);
          return null;
        }

        // Groq 不直接提供信心度，我們使用一個估算值
        const confidence = categoryText === category.toLowerCase() ? 0.85 : 0.70;

        logger.info(`Groq AI 分類結果 (模型: ${model}): ${category} (估算信心度: ${(confidence * 100).toFixed(1)}%)`);

        return {
          category,
          confidence,
          source: "groq",
        };
      } catch (error: any) {
        lastError = error;
        // 如果不是最後一個模型，繼續嘗試
        if (model !== models[models.length - 1]) {
          continue;
        }
        // 最後一個模型也失敗了
        throw error;
      }
    }

    // 所有模型都失敗了
    if (lastError) {
      throw lastError;
    }

    return null;
  } catch (error: any) {
    logger.warn(`Groq AI 分類失敗: ${error.message}`);
    return null;
  }
}

/**
 * 使用 Hugging Face Zero-Shot 模型進行新聞分類（選手 A）
 * 使用 mDeBERTa-v3-base-mnli-xnli 模型，支援中文且無需訓練
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 分類結果
 */
async function classifyWithHuggingFace(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  // 只嘗試一次，如果失敗就快速放棄（主要依賴 Groq）
  const model = "facebook/bart-large-mnli";
  const text = `${title}\n\n${content}`.substring(0, 1000);
  const labels = Object.keys(CATEGORY_DESCRIPTIONS);
  const endpoint = `https://api-inference.huggingface.co/models/${model}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          candidate_labels: labels,
          multi_label: false,
        },
      }),
    });

    // 如果模型不可用（410/404），直接放棄
    if (response.status === 410 || response.status === 404) {
      // 靜默失敗，不輸出日誌（因為主要依賴 Groq）
      return null;
    }

    // 處理 503 錯誤（模型正在加載）- 只等待一次，最多 10 秒
    if (response.status === 503) {
      const errorData = await response.json().catch(() => ({}));
      const estimatedTime = Math.min(errorData.estimated_time || 10, 10);
      // 如果等待時間太長，直接放棄
      if (estimatedTime > 10) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, estimatedTime * 1000));
      
      // 重試一次
      const retryResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: labels,
            multi_label: false,
          },
        }),
      });
      
      if (!retryResponse.ok || retryResponse.status === 410 || retryResponse.status === 404) {
        return null;
      }
      
      const result = await retryResponse.json();
      if (result.labels && result.scores) {
        const maxIndex = result.scores.indexOf(Math.max(...result.scores));
        const category = result.labels[maxIndex] as NewsCategory;
        const confidence = result.scores[maxIndex];
        logger.info(
          `Hugging Face 分類結果: ${category} (信心度: ${(confidence * 100).toFixed(1)}%)`
        );
        return {
          category,
          confidence,
          source: "huggingface",
        };
      }
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    // 處理錯誤響應
    if (result.error) {
      return null;
    }

    // 解析結果
    if (result.labels && result.scores) {
      const maxIndex = result.scores.indexOf(Math.max(...result.scores));
      const category = result.labels[maxIndex] as NewsCategory;
      const confidence = result.scores[maxIndex];
      logger.info(
        `Hugging Face 分類結果: ${category} (信心度: ${(confidence * 100).toFixed(1)}%)`
      );
      return {
        category,
        confidence,
        source: "huggingface",
      };
    }

    return null;
  } catch (error: any) {
    // 任何錯誤都直接放棄，不重試
    return null;
  }
}

/**
 * 使用 Groq 作為裁判進行最終裁決（當兩個 AI 意見分歧時）
 * @param title 新聞標題
 * @param content 新聞內容
 * @param hfResult Hugging Face 的分類結果
 * @param groqResult Groq 的分類結果
 * @returns 最終分類
 */
async function judgeWithGroq(
  title: string,
  content: string,
  hfResult: ClassificationResult,
  groqResult: ClassificationResult
): Promise<NewsCategory> {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      logger.warn("Groq API Key 未設置，無法進行裁判，使用 Hugging Face 結果");
      return hfResult.category;
    }

    const text = `${title}\n\n${content}`.substring(0, 2000);
    const labels = Object.keys(CATEGORY_DESCRIPTIONS);
    const labelsList = labels.join("、");

    const judgePrompt = `你是資深新聞編輯。對於以下這則新聞，你的兩個助手有不同意見。請做出最終裁決。

新聞標題：${title}

新聞內容：${text}

助手 A (AI模型) 認為是：${hfResult.category} (信心度: ${(hfResult.confidence * 100).toFixed(1)}%)
助手 B (語言專家) 認為是：${groqResult.category} (信心度: ${(groqResult.confidence * 100).toFixed(1)}%)

可選分類：${labelsList}

請考慮哪個分類更準確。如果內容包含具體的物資請求(如水、口罩)，傾向選「financial-support」。
如果包含封路或巴士改道，選「event-update」。
如果包含死傷人數統計，選「statistics」。
如果包含政府部門的正式公告，選「government-announcement」。

只需回答最終分類名稱（例如：event-update），不要解釋。`;

    // 使用更強大的模型作為裁判（優先使用便宜的模型）
    const judgeModels = [
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
    ];

    for (const model of judgeModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: "你是一個專業的新聞分類裁判，請根據兩個助手的意見做出最終裁決。",
              },
              {
                role: "user",
                content: judgePrompt,
              },
            ],
            temperature: 0.1, // 低溫度確保穩定
            max_tokens: 50,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.code === "model_decommissioned" || response.status === 400) {
            if (model !== judgeModels[judgeModels.length - 1]) {
              continue; // 嘗試下一個模型
            }
          }
          throw new Error(`Groq API error: ${response.status}`);
        }

        const result = await response.json();
        const verdictText = result.choices?.[0]?.message?.content?.trim().toLowerCase();

        if (!verdictText) {
          throw new Error("Groq 裁判返回空結果");
        }

        // 驗證返回的分類是否有效
        const verdict = labels.find(
          (label) => label.toLowerCase() === verdictText || verdictText.includes(label.toLowerCase())
        ) as NewsCategory | undefined;

        if (verdict) {
          logger.info(`⚖️ 最終裁決 (模型: ${model}): ${verdict}`);
          return verdict;
        } else {
          logger.warn(`Groq 裁判返回無效分類: ${verdictText}，使用 Hugging Face 結果`);
          return hfResult.category;
        }
      } catch (error: any) {
        if (model !== judgeModels[judgeModels.length - 1]) {
          continue; // 嘗試下一個模型
        }
        throw error;
      }
    }

    // 所有模型都失敗，使用 Hugging Face 結果
    logger.warn("裁判模式失敗，使用 Hugging Face 結果");
    return hfResult.category;
  } catch (error: any) {
    logger.error(`裁判模式失敗: ${error.message}，使用 Hugging Face 結果`);
    return hfResult.category;
  }
}

/**
 * 使用 Hugging Face 和 Groq AI 進行辯論比對分類
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 新聞分類
 */
export async function classifyNewsWithAI(
  title: string,
  content: string
): Promise<NewsCategory> {
  try {
    logger.info("開始 AI 分類（主要使用 Groq，Hugging Face 作為可選驗證）...");

    // 同時調用兩個 AI 服務
    const [huggingFaceResult, groqResult] = await Promise.allSettled([
      classifyWithHuggingFace(title, content),
      classifyWithGroq(title, content),
    ]);

    const hfResult =
      huggingFaceResult.status === "fulfilled" ? huggingFaceResult.value : null;
    const groqResultValue = groqResult.status === "fulfilled" ? groqResult.value : null;

    // 如果兩個服務都失敗，使用備用分類
    if (!hfResult && !groqResultValue) {
      logger.warn("所有 AI 服務都失敗，使用備用分類");
      return classifyNewsFallback(title, content);
    }

    // 如果只有一個服務成功，使用該結果
    if (!hfResult && groqResultValue) {
      logger.info("僅 Groq AI 成功，使用 Groq 結果");
      return groqResultValue.category;
    }

    if (hfResult && !groqResultValue) {
      logger.info("僅 Hugging Face 成功，使用 Hugging Face 結果");
      return hfResult.category;
    }

    // 兩個服務都成功，進行辯論比對
    if (hfResult && groqResultValue) {
      logger.info("🔹 選手 A (Hugging Face) 建議: " + 
        `${hfResult.category} (信心度: ${(hfResult.confidence * 100).toFixed(1)}%)`);
      logger.info("🔸 選手 B (Groq) 建議: " + 
        `${groqResultValue.category} (信心度: ${(groqResultValue.confidence * 100).toFixed(1)}%)`);

      // 情況一：雙方達成共識
      if (hfResult.category === groqResultValue.category) {
        logger.info("✅ 雙方達成共識！使用該分類");
        return hfResult.category;
      }

      // 情況二：意見分歧，啟動裁判模式
      logger.warn(
        `⚠️ 意見分歧！啟動裁判模式...`
      );

      // 如果 HF 信心極高 (>0.95)，傾向相信 HF（因為它是專門做分類的）
      if (hfResult.confidence > 0.95) {
        logger.info(
          `⚖️ 裁判判定: Hugging Face 信心極高 (${(hfResult.confidence * 100).toFixed(1)}%)，採納其意見。`
        );
        return hfResult.category;
      }

      // 否則，讓 Groq 擔任裁判，參考 HF 的意見進行最終裁決
      return await judgeWithGroq(title, content, hfResult, groqResultValue);
    }

    // 不應該到達這裡，但為了類型安全
    return classifyNewsFallback(title, content);
  } catch (error: any) {
    logger.error(`AI 分類失敗: ${error.message}，使用備用分類`);
    return classifyNewsFallback(title, content);
  }
}

/**
 * 備用分類方法（當 AI 分類失敗時使用）
 * 使用關鍵詞匹配進行簡單分類
 */
function classifyNewsFallback(
  title: string,
  content: string
): NewsCategory {
  const text = `${title} ${content}`.toLowerCase();

  // 事件更新關鍵詞
  if (
    text.includes("火勢") ||
    text.includes("救援") ||
    text.includes("現場") ||
    text.includes("進展") ||
    text.includes("控制") ||
    text.includes("撲救")
  ) {
    return "event-update";
  }

  // 經濟支援關鍵詞
  if (
    text.includes("資助") ||
    text.includes("補助") ||
    text.includes("津貼") ||
    text.includes("賠償") ||
    text.includes("基金") ||
    text.includes("捐款") ||
    text.includes("財政") ||
    text.includes("經濟") ||
    text.includes("現金")
  ) {
    return "financial-support";
  }

  // 情緒支援關鍵詞
  if (
    text.includes("心理") ||
    text.includes("輔導") ||
    text.includes("情緒") ||
    text.includes("社工") ||
    text.includes("精神健康") ||
    text.includes("創傷") ||
    text.includes("哀傷")
  ) {
    return "emotional-support";
  }

  // 住宿支援關鍵詞
  if (
    text.includes("庇護") ||
    text.includes("住宿") ||
    text.includes("臨時") ||
    text.includes("過渡性房屋") ||
    text.includes("休息站") ||
    text.includes("社區會堂")
  ) {
    return "accommodation";
  }

  // 醫療/法律支援關鍵詞
  if (
    text.includes("醫療") ||
    text.includes("法律") ||
    text.includes("諮詢") ||
    text.includes("義診") ||
    text.includes("醫療站")
  ) {
    return "medical-legal";
  }

  // 重建資訊關鍵詞
  if (
    text.includes("重建") ||
    text.includes("恢復") ||
    text.includes("修復") ||
    text.includes("時間表")
  ) {
    return "reconstruction";
  }

  // 統計數據關鍵詞
  if (
    text.includes("死亡") ||
    text.includes("受傷") ||
    text.includes("失蹤") ||
    text.includes("統計") ||
    text.includes("人數")
  ) {
    return "statistics";
  }

  // 社區支援關鍵詞
  if (
    text.includes("義工") ||
    text.includes("物資") ||
    text.includes("社區") ||
    text.includes("志願") ||
    text.includes("民間")
  ) {
    return "community-support";
  }

  // 政府公告關鍵詞
  if (
    text.includes("政府") ||
    text.includes("民政") ||
    text.includes("社會福利署") ||
    text.includes("消防處") ||
    text.includes("官方")
  ) {
    return "government-announcement";
  }

  // 調查關鍵詞
  if (
    text.includes("調查") ||
    text.includes("刑事") ||
    text.includes("貪污") ||
    text.includes("貪污") ||
    text.includes("執法") ||
    text.includes("檢控") ||
    text.includes("起訴") ||
    text.includes("拘捕") ||
    text.includes("審訊") ||
    text.includes("法庭") ||
    text.includes("廉政公署") ||
    text.includes("ICAC") ||
    text.includes("警方") ||
    text.includes("警務處") ||
    text.includes("事故調查") ||
    text.includes("原因調查") ||
    text.includes("責任調查")
  ) {
    return "investigation";
  }

  // 默認為一般新聞
  return "general-news";
}

