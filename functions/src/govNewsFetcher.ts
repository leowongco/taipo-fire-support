/**
 * 政府新聞公報獲取器
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { load } from "cheerio";

// 使用已初始化的 admin（在 index.ts 中初始化）
const db = admin.firestore();

// 火災相關關鍵詞（核心關鍵詞，必須包含）
const CORE_FIRE_KEYWORDS = [
  "火",
  "火警",
  "火災",
  "火災事故",
  "火災現場",
  "宏福苑", // 特定地點
];

// 輔助關鍵詞（如果與核心關鍵詞一起出現，則更可能是相關的）
const SUPPORTING_KEYWORDS = [
  "大埔",
  "宏福",
  "庇護中心",
  "臨時庇護",
  "疏散",
  "消防",
  "救援",
  "緊急",
  "撤離",
];

// 檢查文本是否與火災相關
function isFireRelated(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  const lowerText = text.toLowerCase();
  
  // 必須包含至少一個核心關鍵詞
  const hasCoreKeyword = CORE_FIRE_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (hasCoreKeyword) {
    return true;
  }
  
  // 如果沒有核心關鍵詞，檢查是否同時包含多個輔助關鍵詞
  // 這可以幫助過濾掉只包含"緊急"或"救援"但與火災無關的新聞
  const supportingCount = SUPPORTING_KEYWORDS.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // 如果包含 2 個或以上的輔助關鍵詞，且包含"大埔"或"宏福"，則認為相關
  if (supportingCount >= 2) {
    return lowerText.includes("大埔") || lowerText.includes("宏福");
  }
  
  return false;
}

// 解析 RSS pubDate 為中文日期格式
function parseRSSDate(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  } catch (error) {
    return new Date().toLocaleDateString("zh-HK");
  }
}

// 清理 HTML 標籤和實體
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // 移除 HTML 標籤
    .replace(/&nbsp;/g, " ") // 替換 &nbsp;
    .replace(/&amp;/g, "&") // 替換 &amp;
    .replace(/&lt;/g, "<") // 替換 &lt;
    .replace(/&gt;/g, ">") // 替換 &gt;
    .replace(/&quot;/g, '"') // 替換 &quot;
    .replace(/&#39;/g, "'") // 替換 &#39;
    .replace(/\s+/g, " ") // 合併多個空格
    .trim();
}

// 獲取政府新聞公報（使用 RSS Feed）
async function fetchGovNews(): Promise<
  Array<{ title: string; url: string; date: string; description?: string }>
> {
  const rssUrl = "https://www.info.gov.hk/gia/rss/general_zh.xml";

  try {
    logger.info(`📰 正在從 RSS Feed 獲取政府新聞: ${rssUrl}`);

    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xml = await response.text();
    const $ = load(xml, { xmlMode: true });

    const newsItems: Array<{
      title: string;
      url: string;
      date: string;
      description?: string;
    }> = [];

    // 解析 RSS items
    $("item").each((_, element) => {
      const $item = $(element);
      const title = $item.find("title").text().trim();
      const link = $item.find("link").text().trim();
      const pubDate = $item.find("pubDate").text().trim();
      const description = $item.find("description").text().trim();

      if (!title || !link) {
        return;
      }

      // 檢查是否與火災相關（檢查標題和描述）
      const titleRelated = isFireRelated(title);
      const descRelated = isFireRelated(description);
      
      if (titleRelated || descRelated) {
        const date = parseRSSDate(pubDate);
        logger.info(`✅ 找到相關新聞: ${title}`);
        newsItems.push({
          title,
          url: link,
          date,
          description: cleanHtml(description),
        });
      } else {
        logger.debug(`⏭️  跳過不相關新聞: ${title}`);
      }
    });

    logger.info(`✅ 從 RSS Feed 找到 ${newsItems.length} 條相關新聞`);
    return newsItems;
  } catch (error: any) {
    logger.error(`❌ 獲取 RSS Feed 時發生錯誤: ${error.message}`);
    throw new Error(`無法獲取政府新聞 RSS Feed: ${error.message}`);
  }
}

// 獲取新聞詳細內容
async function fetchNewsContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);

    let content = "";

    const contentSelectors = [
      "#pressrelease",
      ".pressrelease",
      "#content",
      ".content",
      "article",
      "main",
    ];

    for (const selector of contentSelectors) {
      const $content = $(selector);
      if ($content.length > 0) {
        content = $content.text().trim();
        break;
      }
    }

    if (!content) {
      $("p").each((_, element) => {
        const text = $(element).text().trim();
        if (text.length > 20) {
          content += text + "\n\n";
        }
      });
    }

    return content.trim() || "無法獲取新聞內容";
  } catch (error: any) {
    logger.error(`獲取新聞內容時發生錯誤 (${url}):`, error.message);
    return "無法獲取新聞內容";
  }
}

// 檢查公告是否已存在
async function announcementExists(title: string): Promise<boolean> {
  try {
    const snapshot = await db
      .collection("announcements")
      .where("title", "==", title)
      .limit(1)
      .get();
    return !snapshot.empty;
  } catch (error) {
    logger.error("檢查公告是否存在時發生錯誤:", error);
    return false;
  }
}

// 添加公告到 Firestore
async function addAnnouncement(news: {
  title: string;
  url: string;
  date: string;
  description?: string;
  content?: string;
}): Promise<boolean> {
  try {
    // 檢查是否已存在
    const exists = await announcementExists(news.title);
    if (exists) {
      logger.info(`跳過已存在的公告: ${news.title}`);
      return false;
    }

    // 使用 description 作為內容，如果沒有則獲取完整內容
    let content = news.description || news.content;
    if (!content) {
      logger.info(`正在獲取新聞內容: ${news.title}`);
      content = await fetchNewsContent(news.url);
    }

    // 判斷是否為緊急
    const isUrgent =
      isFireRelated(news.title) &&
      (news.title.includes("緊急") ||
        news.title.includes("火警") ||
        news.title.includes("火災") ||
        (content && (content.includes("緊急") || content.includes("撤離"))));

    // 設置標籤
    let tag: 'urgent' | 'gov' | 'news' = 'gov'; // 默認為政府新聞（因為來自政府新聞公報）
    if (isUrgent) {
      tag = 'urgent'; // 緊急新聞
    }

    // 解析日期
    let timestamp = admin.firestore.Timestamp.now();
    try {
      const dateMatch = news.date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        timestamp = admin.firestore.Timestamp.fromDate(date);
      }
    } catch (error) {
      // 使用當前時間
    }

    const announcement = {
      title: news.title,
      content: content,
      source: "香港政府新聞公報",
      url: news.url,
      isUrgent,
      tag,
      timestamp,
    };

    await db.collection("announcements").add(announcement);
    logger.info(`✅ 已添加公告: ${news.title}`);
    return true;
  } catch (error: any) {
    logger.error(`添加公告時發生錯誤 (${news.title}):`, error.message);
    return false;
  }
}

// 主函數：獲取並添加新聞
export async function fetchAndAddGovNews(): Promise<{
  success: boolean;
  added: number;
  total: number;
  message: string;
}> {
  try {
    logger.info("📰 開始獲取政府新聞公報...");

    // 獲取新聞
    const newsList = await fetchGovNews();

    if (newsList.length === 0) {
      logger.info("ℹ️  沒有找到相關的新聞");
      return {
        success: true,
        added: 0,
        total: 0,
        message: "沒有找到相關的新聞",
      };
    }

    logger.info(`📝 開始處理 ${newsList.length} 條新聞...`);

    let addedCount = 0;
    for (const news of newsList) {
      const added = await addAnnouncement(news);
      if (added) {
        addedCount++;
      }
      // 添加延遲避免請求過快
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const message = `處理完成: 新增 ${addedCount} 條公告，共處理 ${newsList.length} 條新聞`;
    logger.info(`✅ ${message}`);

    return {
      success: true,
      added: addedCount,
      total: newsList.length,
      message,
    };
  } catch (error: any) {
    logger.error("❌ 執行失敗:", error.message);
    throw error;
  }
}

