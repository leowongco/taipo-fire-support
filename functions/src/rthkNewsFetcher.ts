/**
 * RTHK 即時新聞 RSS 獲取器
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { load } from "cheerio";

// 使用已初始化的 admin（在 index.ts 中初始化）
const db = admin.firestore();

// 火災相關關鍵詞
const FIRE_KEYWORDS = [
  "火",
  "火警",
  "火災",
  "火災事故",
  "火災現場",
  "大埔",
  "宏福苑",
  "宏福",
  "庇護中心",
  "臨時庇護",
  "疏散",
  "消防",
  "救援",
  "緊急",
  "撤離",
  "五級火",
  "四級火",
  "三級火",
  "二級火",
  "一級火",
];

// 檢查文本是否與火災相關
function isFireRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return FIRE_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

// 解析 RSS XML 日期
function parseRSSDate(dateString: string): Date {
  try {
    // RSS 日期格式通常是: "Thu, 27 Nov 2025 01:20:24 +0800"
    return new Date(dateString);
  } catch (error) {
    logger.warn(`無法解析日期: ${dateString}`);
    return new Date();
  }
}

// 獲取 RTHK RSS 新聞
async function fetchRTHKNews(): Promise<
  Array<{ title: string; url: string; date: string; description: string }>
> {
  try {
    const rssUrl = "https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml";
    logger.info(`正在獲取 RTHK RSS: ${rssUrl}`);

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
      description: string;
    }> = [];

    // 解析 RSS items
    $("item").each((_, element) => {
      const $item = $(element);
      const title = $item.find("title").text().trim();
      const link = $item.find("link").text().trim();
      const description = $item.find("description").text().trim();
      const pubDate = $item.find("pubDate").text().trim();
      const guid = $item.find("guid").text().trim();

      // 使用 link 或 guid 作為 URL
      const url = link || guid;

      if (!title || !url) {
        return;
      }

      // 檢查標題或描述是否與火災相關
      const titleRelated = isFireRelated(title);
      const descRelated = description && isFireRelated(description);

      if (titleRelated || descRelated) {
        // 解析日期
        let dateStr = new Date().toLocaleDateString("zh-HK");
        if (pubDate) {
          try {
            const date = parseRSSDate(pubDate);
            dateStr = date.toLocaleDateString("zh-HK", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          } catch (error) {
            // 使用當前日期
          }
        }

        newsItems.push({
          title,
          url,
          date: dateStr,
          description: description || "",
        });
      }
    });

    logger.info(`找到 ${newsItems.length} 條相關新聞`);
    return newsItems;
  } catch (error: any) {
    logger.error(`獲取 RTHK RSS 時發生錯誤: ${error.message}`);
    throw error;
  }
}

// 獲取新聞詳細內容（如果需要）
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

    // 嘗試多種可能的內容選擇器
    const contentSelectors = [
      ".article-content",
      ".content",
      "#content",
      "article",
      ".news-content",
      "main",
    ];

    for (const selector of contentSelectors) {
      const $content = $(selector);
      if ($content.length > 0) {
        content = $content.text().trim();
        break;
      }
    }

    // 如果找不到特定容器，嘗試獲取所有段落
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
async function announcementExists(title: string, url: string): Promise<boolean> {
  try {
    // 檢查標題或 URL 是否已存在
    const titleSnapshot = await db
      .collection("announcements")
      .where("title", "==", title)
      .limit(1)
      .get();

    if (!titleSnapshot.empty) {
      return true;
    }

    const urlSnapshot = await db
      .collection("announcements")
      .where("url", "==", url)
      .limit(1)
      .get();

    return !urlSnapshot.empty;
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
  description: string;
  content?: string;
}): Promise<boolean> {
  try {
    // 檢查是否已存在
    const exists = await announcementExists(news.title, news.url);
    if (exists) {
      logger.info(`跳過已存在的公告: ${news.title}`);
      return false;
    }

    // 獲取新聞內容（如果描述太短，嘗試獲取完整內容）
    let content = news.description;
    if (!news.content && (news.description.length < 100 || !news.description)) {
      logger.info(`正在獲取新聞內容: ${news.title}`);
      try {
        const fullContent = await fetchNewsContent(news.url);
        if (fullContent && fullContent !== "無法獲取新聞內容") {
          content = fullContent;
        } else {
          content = news.description || "無詳細內容";
        }
      } catch (error) {
        content = news.description || "無詳細內容";
      }
    } else if (news.content) {
      content = news.content;
    }

    // 判斷是否為緊急
    // 優先檢查是否包含緊急公告的標準格式文字
    const urgentAnnouncementText = "電台及電視台當值宣布員注意";
    const hasUrgentAnnouncementFormat = 
      news.title.includes(urgentAnnouncementText) || 
      content.includes(urgentAnnouncementText) ||
      news.description.includes(urgentAnnouncementText);

    const isUrgent =
      hasUrgentAnnouncementFormat || // 包含緊急公告格式文字，直接標記為緊急
      (isFireRelated(news.title) &&
        (news.title.includes("緊急") ||
          news.title.includes("火警") ||
          news.title.includes("火災") ||
          news.title.includes("五級火") ||
          news.title.includes("四級火") ||
          content.includes("緊急") ||
          content.includes("撤離") ||
          content.includes("死亡") ||
          content.includes("失聯")));

    // 設置標籤：RTHK 新聞默認為 'news'
    let tag: 'urgent' | 'gov' | 'news' = 'news';
    if (isUrgent) {
      tag = 'urgent';
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
      } else {
        // 嘗試解析其他日期格式
        const parsedDate = parseRSSDate(news.date);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = admin.firestore.Timestamp.fromDate(parsedDate);
        }
      }
    } catch (error) {
      // 使用當前時間
    }

    const announcement = {
      title: news.title,
      content: content,
      source: "香港電台 (RTHK)",
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
export async function fetchAndAddRTHKNews(): Promise<{
  success: boolean;
  added: number;
  total: number;
  message: string;
}> {
  try {
    logger.info("📰 開始獲取 RTHK 即時新聞...");

    // 獲取新聞
    const newsList = await fetchRTHKNews();

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

