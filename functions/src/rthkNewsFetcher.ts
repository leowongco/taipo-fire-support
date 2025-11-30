/**
 * RTHK 即時新聞 RSS 獲取器
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { load } from "cheerio";
import { extractCasualtyStats, extractEventStartDate } from "./statExtractor";
import { classifyNewsWithAI } from "./aiNewsClassifier";
import { updateEventStatsWithValidation } from "./statValidator";

// 延遲獲取 Firestore 實例（避免在模組加載時初始化）
function getDb() {
  return admin.firestore();
}

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
  Array<{ title: string; url: string; date: string; description: string; pubDate?: string }>
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
      pubDate?: string;
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
          pubDate: pubDate || undefined, // 保留原始 pubDate 用於時間戳解析
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
        // 移除 script 和 style 標籤
        $content.find("script, style").remove();
        
        // 將 <br> 和 <br/> 轉換為換行符
        $content.find("br").replaceWith("\n");
        
        // 處理段落和塊級元素，保留格式
        const paragraphs: string[] = [];
        
        // 處理 <p> 標籤
        $content.find("p").each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 0) {
            paragraphs.push(text);
          }
        });
        
        // 如果沒有找到 <p> 標籤，處理其他塊級元素
        if (paragraphs.length === 0) {
          $content.find("div, li, h1, h2, h3, h4, h5, h6").each((_, element) => {
            const text = $(element).text().trim();
            if (text.length > 20) { // 過濾太短的內容
              paragraphs.push(text);
            }
          });
        }
        
        // 如果還是沒有找到，使用整個容器的文本
        if (paragraphs.length === 0) {
          const fullText = $content.text().trim();
          if (fullText.length > 0) {
            // 嘗試按句號、問號、感嘆號分割段落
            paragraphs.push(...fullText.split(/[。！？]\s*/).filter(p => p.trim().length > 0));
          }
        }
        
        // 組合段落，每個段落之間用兩個換行符分隔
        content = paragraphs.join("\n\n");
        
        // 清理多餘的空白行（最多保留一個空行）
        content = content.replace(/\n{3,}/g, "\n\n").trim();
        
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
      // 清理多餘的空白行
      content = content.replace(/\n{3,}/g, "\n\n").trim();
    }

    return content.trim() || "無法獲取新聞內容";
  } catch (error: any) {
    logger.error(`獲取新聞內容時發生錯誤 (${url}):`, error.message);
    return "無法獲取新聞內容";
  }
}

// 更新事件開始時間
async function updateEventStartDate(eventStartDate: Date): Promise<void> {
  try {
    const db = getDb();
    const statsSnapshot = await db.collection("eventStats").limit(1).get();
    
    if (statsSnapshot.empty) {
      // 如果沒有現有數據，創建新文檔
      await db.collection("eventStats").add({
        eventStartDate: admin.firestore.Timestamp.fromDate(eventStartDate),
        casualties: 0,
        injured: 0,
        missing: 0,
        lastUpdated: admin.firestore.Timestamp.now(),
        source: "自動提取",
      });
    } else {
      // 更新現有數據（取最早的時間）
      const existingDoc = statsSnapshot.docs[0];
      const existingData = existingDoc.data();
      const existingStartDate = existingData.eventStartDate?.toDate();
      
      if (!existingStartDate || eventStartDate < existingStartDate) {
        await existingDoc.ref.update({
          eventStartDate: admin.firestore.Timestamp.fromDate(eventStartDate),
          lastUpdated: admin.firestore.Timestamp.now(),
        });
        logger.info(`✅ 更新事件開始時間: ${eventStartDate.toLocaleDateString('zh-HK')}`);
      }
    }
  } catch (error: any) {
    logger.error(`更新事件開始時間時發生錯誤: ${error.message}`);
  }
}

// 檢查新聞是否已存在
async function newsExists(title: string, url: string): Promise<boolean> {
  try {
    const db = getDb();
    // 檢查標題或 URL 是否已存在
    const titleSnapshot = await db
      .collection("news")
      .where("title", "==", title)
      .limit(1)
      .get();

    if (!titleSnapshot.empty) {
      return true;
    }

    const urlSnapshot = await db
      .collection("news")
      .where("url", "==", url)
      .limit(1)
      .get();

    return !urlSnapshot.empty;
  } catch (error) {
    logger.error("檢查新聞是否存在時發生錯誤:", error);
    return false;
  }
}

// 添加新聞到 Firestore
async function addNews(news: {
  title: string;
  url: string;
  date: string;
  description: string;
  content?: string;
  pubDate?: string;
}): Promise<boolean> {
  try {
    // 檢查是否已存在
    const exists = await newsExists(news.title, news.url);
    if (exists) {
      logger.info(`跳過已存在的新聞: ${news.title}`);
      return false;
    }

    // 獲取完整新聞內容用於統計分析
    // 優先使用已提供的內容，否則獲取完整內容
    let content = news.content || news.description;
    if (!content || content.length < 200) {
      // 如果沒有內容或內容太短，獲取完整內容以確保統計分析的準確性
      logger.info(`正在獲取完整新聞內容用於統計分析: ${news.title}`);
      try {
        const fullContent = await fetchNewsContent(news.url);
        if (fullContent && fullContent !== "無法獲取新聞內容") {
          content = fullContent;
          logger.info(`✅ 已獲取完整內容 (${fullContent.length} 字符)`);
        } else if (!content) {
          content = news.description || "無詳細內容";
        }
      } catch (error: any) {
        logger.warn(`獲取完整內容失敗: ${error.message}，使用描述內容`);
        if (!content) {
        content = news.description || "無詳細內容";
        }
      }
    }

    // 使用 AI 進行新聞分類
    const newsCategory = await classifyNewsWithAI(news.title, content || "");

    // 設置標籤（基於來源）
    const tag: 'gov' | 'news' = 'news'; // RTHK 新聞

    // 解析日期和時間
    let timestamp = admin.firestore.Timestamp.now();
    try {
      // 優先使用原始 pubDate（包含完整時間信息）
      if (news.pubDate) {
        const parsedDate = parseRSSDate(news.pubDate);
        if (!isNaN(parsedDate.getTime())) {
          timestamp = admin.firestore.Timestamp.fromDate(parsedDate);
          logger.info(`使用 RSS pubDate 解析時間: ${parsedDate.toLocaleString('zh-HK')}`);
        }
      } else {
        // 如果沒有 pubDate，嘗試從格式化的日期字符串解析
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
      }
    } catch (error: any) {
      logger.warn(`解析日期時發生錯誤: ${error.message}，使用當前時間`);
      // 使用當前時間
    }

    const announcement = {
      title: news.title,
      content: content,
      source: "香港電台 (RTHK)",
      url: news.url,
      tag,
      newsCategory,
      timestamp,
    };

    const db = getDb();
    await db.collection("news").add(announcement);
    logger.info(`✅ 已添加新聞: ${news.title} (分類: ${newsCategory})`);

    // 提取統計數據並更新 eventStats（使用多來源驗證）
    try {
      const stats = extractCasualtyStats(`${news.title} ${content}`);
      if (stats.found) {
        await updateEventStatsWithValidation(stats, `RTHK新聞: ${news.title}`, timestamp);
      }

      // 嘗試提取事件開始時間
      const eventStartDate = extractEventStartDate(news.title, content);
      if (eventStartDate) {
        await updateEventStartDate(eventStartDate);
      }
    } catch (error: any) {
      logger.warn(`提取統計數據時發生錯誤: ${error.message}`);
    }

    return true;
  } catch (error: any) {
    logger.error(`添加新聞時發生錯誤 (${news.title}):`, error.message);
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
      const added = await addNews(news);
      if (added) {
        addedCount++;
      }
      // 添加延遲避免請求過快
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const message = `處理完成: 新增 ${addedCount} 條新聞，共處理 ${newsList.length} 條新聞`;
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

