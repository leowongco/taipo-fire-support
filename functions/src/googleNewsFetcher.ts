/**
 * Google News RSS 獲取器
 * 從 Google News 獲取與火災相關的新聞
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
    return new Date(dateString);
  } catch (error) {
    logger.warn(`無法解析日期: ${dateString}`);
    return new Date();
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

// 清理 Google News 標題（去除新聞機構後綴）
// 例如："宏福苑五級火｜至今128人死亡 - 香港電台新聞網" -> "宏福苑五級火｜至今128人死亡"
function cleanGoogleNewsTitle(title: string): string {
  // 去除常見的後綴格式：
  // - " - 香港電台新聞網"
  // - " - RTHK"
  // - " - 明報"
  // - " - 星島日報"
  // 等等
  const patterns = [
    /\s*-\s*[^-]+$/i, // 匹配 " - 任何文字" 在結尾
    /\s*–\s*[^–]+$/i, // 匹配 " – 任何文字" 在結尾（長破折號）
    /\s*—\s*[^—]+$/i, // 匹配 " — 任何文字" 在結尾（長破折號）
  ];

  let cleaned = title.trim();
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned;
}

// 從 Google News 鏈接中提取原始新聞 URL
// Google News 的鏈接格式：https://news.google.com/rss/articles/...
// 需要訪問該鏈接並提取重定向後的實際新聞 URL
async function extractOriginalUrl(googleNewsUrl: string): Promise<string> {
  try {
    // 先嘗試直接訪問 Google News 鏈接，獲取重定向
    const response = await fetch(googleNewsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    // 如果重定向，使用最終 URL
    if (response.url && response.url !== googleNewsUrl) {
      return response.url;
    }

    // 如果沒有重定向，嘗試從 HTML 中提取
    const html = await response.text();
    const $ = load(html);
    
    // 嘗試找到原始新聞鏈接
    const originalLink = $('a[href*="rthk.hk"], a[href*="info.gov.hk"], a[href*="mingpao"], a[href*="hk01"]').first().attr('href');
    if (originalLink) {
      return originalLink;
    }

    // 如果都找不到，返回 Google News 鏈接
    return googleNewsUrl;
  } catch (error: any) {
    logger.warn(`提取原始 URL 失敗: ${error.message}，使用 Google News 鏈接`);
    return googleNewsUrl;
  }
}

// 獲取 Google News RSS 新聞
async function fetchGoogleNews(): Promise<
  Array<{ title: string; url: string; date: string; description: string; pubDate?: string; cleanedTitle: string }>
> {
  try {
    const rssUrl = "https://news.google.com/rss?pz=1&cf=all&hl=zh-HK&gl=HK&ceid=HK:zh-Hant";
    logger.info(`正在獲取 Google News RSS: ${rssUrl}`);

    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
      cleanedTitle: string;
    }> = [];

    // 解析 RSS items
    $("item").each((_, element) => {
      const $item = $(element);
      const title = $item.find("title").text().trim();
      const link = $item.find("link").text().trim();
      const descriptionHtml = $item.find("description").html() || $item.find("description").text();
      const pubDate = $item.find("pubDate").text().trim();
      const guid = $item.find("guid").text().trim();

      // 使用 link 或 guid 作為 URL
      const url = link || guid;

      if (!title || !url) {
        return;
      }

      // 清理標題（去除新聞機構後綴）
      const cleanedTitle = cleanGoogleNewsTitle(title);

      // 清理描述中的 HTML 標籤，只保留純文本
      const description = cleanHtml(descriptionHtml || "");

      // 檢查標題或描述是否與火災相關
      const titleRelated = isFireRelated(cleanedTitle);
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
          title: cleanedTitle, // 使用清理後的標題
          url,
          date: dateStr,
          description: description || "",
          pubDate: pubDate || undefined,
          cleanedTitle, // 保留清理後的標題用於重複檢查
        });
      }
    });

    logger.info(`找到 ${newsItems.length} 條相關新聞`);
    return newsItems;
  } catch (error: any) {
    logger.error(`獲取 Google News RSS 時發生錯誤: ${error.message}`);
    throw error;
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

// 獲取新聞詳細內容
async function fetchNewsContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
            if (text.length > 20) {
              paragraphs.push(text);
            }
          });
        }
        
        // 如果還是沒有找到，使用整個容器的文本
        if (paragraphs.length === 0) {
          const fullText = $content.text().trim();
          if (fullText.length > 0) {
            paragraphs.push(...fullText.split(/[。！？]\s*/).filter(p => p.trim().length > 0));
          }
        }
        
        // 組合段落
        content = paragraphs.join("\n\n");
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
      content = content.replace(/\n{3,}/g, "\n\n").trim();
    }

    return content.trim() || "無法獲取新聞內容";
  } catch (error: any) {
    logger.error(`獲取新聞內容時發生錯誤 (${url}):`, error.message);
    return "無法獲取新聞內容";
  }
}

// 檢查新聞是否已存在（基於清理後的標題）
async function newsExistsByTitle(cleanedTitle: string): Promise<boolean> {
  try {
    const db = getDb();
    // 獲取所有新聞並檢查標題是否相似
    const snapshot = await db.collection("news").get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const existingTitle = data.title || "";
      
      // 清理現有標題並比較
      const existingCleanedTitle = cleanGoogleNewsTitle(existingTitle);
      
      // 如果標題完全匹配，認為是重複
      if (existingCleanedTitle === cleanedTitle) {
        return true;
      }
      
      // 如果標題相似度很高（超過 90%），也認為是重複
      const similarity = calculateSimilarity(existingCleanedTitle, cleanedTitle);
      if (similarity > 0.9) {
        logger.info(`發現相似標題: "${existingCleanedTitle}" vs "${cleanedTitle}" (相似度: ${(similarity * 100).toFixed(1)}%)`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error("檢查新聞是否存在時發生錯誤:", error);
    return false;
  }
}

// 計算兩個字符串的相似度（簡單的 Jaccard 相似度）
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // 使用字符級別的 Jaccard 相似度
  const set1 = new Set(str1);
  const set2 = new Set(str2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// 添加新聞到 Firestore
async function addNews(news: {
  title: string;
  url: string;
  date: string;
  description: string;
  content?: string;
  pubDate?: string;
  cleanedTitle: string;
}): Promise<boolean> {
  try {
    // 檢查是否已存在（基於清理後的標題）
    const exists = await newsExistsByTitle(news.cleanedTitle);
    if (exists) {
      logger.info(`跳過已存在的新聞（標題相似）: ${news.title}`);
      return false;
    }

    // 嘗試提取原始新聞 URL
    let originalUrl = news.url;
    try {
      originalUrl = await extractOriginalUrl(news.url);
      if (originalUrl !== news.url) {
        logger.info(`已提取原始 URL: ${originalUrl}`);
      }
    } catch (error: any) {
      logger.warn(`提取原始 URL 失敗: ${error.message}，使用 Google News 鏈接`);
    }

    // 獲取完整新聞內容用於統計分析
    let content = news.content || news.description;
    if (!content || content.length < 200) {
      logger.info(`正在獲取完整新聞內容用於統計分析: ${news.title}`);
      try {
        const fullContent = await fetchNewsContent(originalUrl);
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

    // 設置標籤
    const tag: 'gov' | 'news' = 'news'; // Google News

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
        }
      }
    } catch (error: any) {
      logger.warn(`解析日期時發生錯誤: ${error.message}，使用當前時間`);
    }

    const announcement = {
      title: news.title, // 使用清理後的標題
      content: content,
      source: "Google News",
      url: originalUrl, // 使用原始 URL（如果提取成功）
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
        await updateEventStatsWithValidation(stats, `Google News: ${news.title}`, timestamp);
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
export async function fetchAndAddGoogleNews(): Promise<{
  success: boolean;
  added: number;
  total: number;
  message: string;
}> {
  try {
    logger.info("📰 開始獲取 Google News...");

    // 獲取新聞
    const newsList = await fetchGoogleNews();

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

