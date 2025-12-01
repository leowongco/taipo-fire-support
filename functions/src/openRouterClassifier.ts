/**
 * 使用 OpenRouter Worker 進行新聞分類
 * 使用黃金三角架構（A、B 辯論，C 獨立裁判）
 */

import * as logger from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";

// 新聞分類類型（與 aiNewsClassifier.ts 保持一致）
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

// OpenRouter Worker URL（使用 Firebase Functions v2 的 defineString）
// 設置方法：在部署時使用 --set-env-vars 或使用 Google Cloud Console
// 已設置默認值，如果默認值正確則無需額外配置
const openRouterWorkerUrl = defineString("OPENROUTER_WORKER_URL", {
  default: "https://news-classifier.lwp.workers.dev",
  description: "OpenRouter Worker URL for news classification",
});

/**
 * 使用 OpenRouter Worker 進行新聞分類
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 新聞分類
 */
export async function classifyNewsWithOpenRouter(
  title: string,
  content: string
): Promise<NewsCategory> {
  try {
    // 獲取 OpenRouter Worker URL
    const workerUrl = openRouterWorkerUrl.value();
    
    if (!workerUrl) {
      logger.warn("OPENROUTER_WORKER_URL 未設置，使用備用分類");
      return classifyNewsFallback(title, content);
    }

    logger.info(`開始使用 OpenRouter Worker 進行分類: ${workerUrl}`);

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`OpenRouter Worker API 錯誤 (${response.status}): ${errorText}`);
      return classifyNewsFallback(title, content);
    }

    const data = await response.json();

    if (data.error) {
      logger.warn(`OpenRouter Worker 返回錯誤: ${data.error}`);
      return classifyNewsFallback(title, content);
    }

    if (!data.category) {
      logger.warn("OpenRouter Worker 返回的數據缺少 category 字段");
      return classifyNewsFallback(title, content);
    }

    const category = data.category as NewsCategory;
    logger.info(
      `✅ OpenRouter Worker 分類結果: ${category} (${data.details || ""})`
    );

    return category;
  } catch (error: any) {
    logger.error(`OpenRouter Worker 分類失敗: ${error.message}`);
    return classifyNewsFallback(title, content);
  }
}

/**
 * 備用分類方法（當 OpenRouter Worker 失敗時使用）
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

