/**
 * 政府新聞公報獲取器
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { load } from "cheerio";
import { extractCasualtyStats, extractEventStartDate } from "./statExtractor";
import { classifyNewsWithOpenRouter } from "./openRouterClassifier";
import { updateEventStatsWithValidation } from "./statValidator";

// 延遲獲取 Firestore 實例（避免在模組加載時初始化）
function getDb() {
  return admin.firestore();
}

// 火災相關關鍵詞（不包括單獨的"火"字，太寬泛）
const FIRE_KEYWORDS = [
  "火警",
  "火災",
  "火災事故",
  "火災現場",
  "大火",
  "火勢",
  "起火",
  "燃燒",
  "火場",
  "五級火",
  "四級火",
  "三級火",
  "二級火",
  "一級火",
  "撲救",
  "滅火",
  "消防員",
  "消防處",
  "消防局",
  "消防隊",
  "傷亡",
  "罹難",
  "遇難",
  "失蹤",
  "受傷",
  "死亡",
  "殉職",
  "庇護中心",
  "臨時住宿",
  "疏散",
  "撤離",
  "過渡性房屋",
  "重建",
  "善後",
  "支援",
  "援助",
  "物資",
  "捐款",
  "應急",
  "調查",
  "原因",
  "責任",
  "承建商",
  "維修工程",
  "棚網",
  "外牆",
  "默哀",
  "弔唁",
  "哀悼",
  "悼念",
  "下半旗",
];

// 地點關鍵詞（必須包含其中一個，確保是大埔火災）
const LOCATION_KEYWORDS = [
  "大埔",
  "宏福苑",
  "宏仁閣",
  "宏道閣",
  "宏福",
];

// 檢查文本是否與大埔火災相關
// 必須同時包含火災相關關鍵詞和地點關鍵詞，以避免誤判其他地區的火災
function isFireRelated(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  const lowerText = text.toLowerCase();
  
  // 檢查是否包含地點關鍵詞
  const hasLocation = LOCATION_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (!hasLocation) {
    // 如果沒有地點關鍵詞，不認為相關（避免誤判其他地區的火災）
    return false;
  }
  
  // 如果包含"宏福苑"、"宏仁閣"、"宏道閣"等特定地點，直接認為相關
  // 因為這些地點本身就與火災事件相關
  if (
    lowerText.includes("宏福苑") ||
    lowerText.includes("宏仁閣") ||
    lowerText.includes("宏道閣")
  ) {
    return true;
  }
  
  // 如果包含"大埔"或"宏福"，必須同時包含火災相關關鍵詞
  const hasFireKeyword = FIRE_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
  
  return hasFireKeyword;
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
  Array<{ title: string; url: string; date: string; description?: string; pubDate?: string }>
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
      pubDate?: string;
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
          pubDate: pubDate || undefined, // 保留原始 pubDate 用於時間戳解析
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
async function newsExists(title: string): Promise<boolean> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection("news")
      .where("title", "==", title)
      .limit(1)
      .get();
    return !snapshot.empty;
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
  description?: string;
  content?: string;
  pubDate?: string;
}): Promise<boolean> {
  try {
    // 檢查是否已存在
    const exists = await newsExists(news.title);
    if (exists) {
      logger.info(`跳過已存在的新聞: ${news.title}`);
      return false;
    }

    // 獲取完整新聞內容用於統計分析
    // 優先使用已提供的內容，否則獲取完整內容
    let content = news.description || news.content;
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

    // 使用 OpenRouter Worker 進行新聞分類
    const newsCategory = await classifyNewsWithOpenRouter(news.title, content || "");

    // 設置標籤（基於來源）
    const tag: 'gov' | 'news' = 'gov'; // 政府新聞

    // 解析日期和時間
    let timestamp = admin.firestore.Timestamp.now();
    try {
      // 優先使用原始 pubDate（包含完整時間信息）
      if (news.pubDate) {
        const parsedDate = new Date(news.pubDate);
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
        }
      }
    } catch (error: any) {
      logger.warn(`解析日期時發生錯誤: ${error.message}，使用當前時間`);
      // 使用當前時間
    }

    const announcement = {
      title: news.title,
      content: content,
      source: "香港政府新聞公報",
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
        await updateEventStatsWithValidation(stats, `政府新聞: ${news.title}`, timestamp);
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

