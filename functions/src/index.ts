/**
 * Firebase Cloud Functions
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {parseTelegramPost} from "./telegramParser";
import {fetchTelegramChannelMessages, scrapeTelegramChannel} from "./telegramFetcher";

// 初始化 Firebase Admin（必須在其他模組導入之前）
admin.initializeApp();
const db = admin.firestore();

// 在初始化後才導入依賴 admin 的模組
import {fetchAndAddGovNews} from "./govNewsFetcher";
import {fetchAndAddRTHKNews} from "./rthkNewsFetcher";
import {fetchAndAddGoogleNews} from "./googleNewsFetcher";
import {classifyNewsWithAI} from "./aiNewsClassifier";
import {updateEventStatsFromWikipedia} from "./wikipediaStatsFetcher";

// 設置全局選項
setGlobalOptions({
  maxInstances: 10,
  region: "asia-east1", // 使用亞洲區域以減少延遲
});

/**
 * 定時任務：每 15 分鐘檢查一次 Telegram 頻道
 * 使用 Cloud Scheduler 觸發（需要手動設置）
 */
export const checkTelegramChannel = onSchedule(
  {
    schedule: "*/15 * * * *", // 每 15 分鐘執行一次
    timeZone: "Asia/Hong_Kong",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    logger.info("開始檢查 Telegram 頻道...");

    try {
      const channelUsername = "universalsentinelsinblack";
      // 從環境變量或 Firebase Functions 配置中讀取 Bot Token
      const botToken = process.env.TELEGRAM_BOT_TOKEN || 
        (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).telegram?.bot_token : undefined);

      let messages: Array<{
        text: string;
        date: number;
        messageId: number;
        link: string;
      }> = [];

      // 優先使用 Bot API（如果配置了 token）
      if (botToken) {
        try {
          const telegramMessages = await fetchTelegramChannelMessages(
            botToken,
            channelUsername,
            20
          );
          messages = telegramMessages.map((msg) => ({
            text: msg.text,
            date: msg.date,
            messageId: msg.message_id,
            link: `https://t.me/${channelUsername}/${msg.message_id}`,
          }));
        } catch (error) {
          logger.warn("Bot API 失敗，嘗試使用網頁爬取:", error);
        }
      }

      // 如果 Bot API 失敗或未配置，使用網頁爬取
      if (messages.length === 0) {
        messages = await scrapeTelegramChannel(channelUsername, 20);
      }

      if (messages.length === 0) {
        logger.warn("未獲取到任何消息");
        return;
      }

      logger.info(`獲取到 ${messages.length} 條消息`);

      // 獲取已處理的消息 ID（存儲在 Firestore 中）
      const processedRef = db.collection("_metadata").doc("telegram_processed");
      const processedDoc = await processedRef.get();
      const processedIds = processedDoc.exists
        ? (processedDoc.data()?.messageIds || [])
        : [];

      let newCount = 0;
      const newProcessedIds: number[] = [...processedIds];

      // 處理每條消息
      for (const message of messages) {
        // 跳過已處理的消息
        if (processedIds.includes(message.messageId)) {
          continue;
        }

        // 解析消息
        const parsed = parseTelegramPost(
          message.text,
          message.messageId,
          channelUsername
        );

        if (!parsed) {
          logger.info(`消息 ${message.messageId} 無法解析，跳過`);
          newProcessedIds.push(message.messageId);
          continue;
        }

        // 檢查是否已存在相同的地點（根據地址和名稱）
        const existingQuery = await db
          .collection("resources")
          .where("address", "==", parsed.address)
          .where("locationName", "==", parsed.locationName)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          // 更新現有資源點
          const existingDoc = existingQuery.docs[0];
          await existingDoc.ref.update({
            ...parsed,
            updatedAt: admin.firestore.Timestamp.fromMillis(message.date * 1000),
            sourceUrl: message.link,
          });
          logger.info(`更新資源點: ${parsed.locationName}`);
        } else {
          // 創建新資源點
          await db.collection("resources").add({
            ...parsed,
            updatedAt: admin.firestore.Timestamp.fromMillis(message.date * 1000),
            timestamp: admin.firestore.Timestamp.fromMillis(message.date * 1000),
          });
          logger.info(`創建新資源點: ${parsed.locationName}`);
          newCount++;
        }

        newProcessedIds.push(message.messageId);
      }

      // 更新已處理的消息 ID（只保留最近 1000 條）
      const trimmedIds = newProcessedIds.slice(-1000);
      await processedRef.set({
        messageIds: trimmedIds,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`處理完成: 新增 ${newCount} 個資源點，共處理 ${messages.length} 條消息`);
    } catch (error) {
      logger.error("處理 Telegram 頻道時發生錯誤:", error);
      throw error;
    }
  }
);

/**
 * 手動觸發檢查 Telegram 頻道（用於測試）
 */
export const manualCheckTelegram = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    logger.info("手動觸發檢查 Telegram 頻道...");

    try {
      const channelUsername = "universalsentinelsinblack";
      // 從環境變量或 Firebase Functions 配置中讀取 Bot Token
      const botToken = process.env.TELEGRAM_BOT_TOKEN || 
        (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).telegram?.bot_token : undefined);

      let messages: Array<{
        text: string;
        date: number;
        messageId: number;
        link: string;
      }> = [];

      if (botToken) {
        try {
          const telegramMessages = await fetchTelegramChannelMessages(
            botToken,
            channelUsername,
            20
          );
          messages = telegramMessages.map((msg) => ({
            text: msg.text,
            date: msg.date,
            messageId: msg.message_id,
            link: `https://t.me/${channelUsername}/${msg.message_id}`,
          }));
        } catch (error) {
          logger.warn("Bot API 失敗，嘗試使用網頁爬取:", error);
        }
      }

      if (messages.length === 0) {
        messages = await scrapeTelegramChannel(channelUsername, 20);
      }

      const processedRef = db.collection("_metadata").doc("telegram_processed");
      const processedDoc = await processedRef.get();
      const processedIds = processedDoc.exists
        ? (processedDoc.data()?.messageIds || [])
        : [];

      let newCount = 0;
      const newProcessedIds: number[] = [...processedIds];

      for (const message of messages) {
        if (processedIds.includes(message.messageId)) {
          continue;
        }

        const parsed = parseTelegramPost(
          message.text,
          message.messageId,
          channelUsername
        );

        if (!parsed) {
          newProcessedIds.push(message.messageId);
          continue;
        }

        const existingQuery = await db
          .collection("resources")
          .where("address", "==", parsed.address)
          .where("locationName", "==", parsed.locationName)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          const existingDoc = existingQuery.docs[0];
          await existingDoc.ref.update({
            ...parsed,
            updatedAt: admin.firestore.Timestamp.fromMillis(message.date * 1000),
            sourceUrl: message.link,
          });
        } else {
          await db.collection("resources").add({
            ...parsed,
            updatedAt: admin.firestore.Timestamp.fromMillis(message.date * 1000),
            timestamp: admin.firestore.Timestamp.fromMillis(message.date * 1000),
          });
          newCount++;
        }

        newProcessedIds.push(message.messageId);
      }

      const trimmedIds = newProcessedIds.slice(-1000);
      await processedRef.set({
        messageIds: trimmedIds,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({
        success: true,
        message: `處理完成: 新增 ${newCount} 個資源點，共處理 ${messages.length} 條消息`,
        newCount,
        totalProcessed: messages.length,
      });
    } catch (error: any) {
      logger.error("處理時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * 定時任務：每小時檢查一次政府新聞公報
 * 自動獲取與火災相關的新聞並添加到 Firestore
 */
export const checkGovNews = onSchedule(
  {
    schedule: "0 * * * *", // 每小時執行一次（每小時的 0 分）
    timeZone: "Asia/Hong_Kong",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    logger.info("開始檢查政府新聞公報...");

    try {
      const result = await fetchAndAddGovNews();
      logger.info(`✅ ${result.message}`);
    } catch (error: any) {
      logger.error("處理政府新聞時發生錯誤:", error);
      throw error;
    }
  }
);

/**
 * 手動觸發檢查政府新聞（用於測試）
 * 訪問: https://[region]-[project-id].cloudfunctions.net/manualCheckGovNews
 */
export const manualCheckGovNews = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    logger.info("手動觸發檢查政府新聞公報...");

    try {
      const result = await fetchAndAddGovNews();
      res.json({
        success: result.success,
        message: result.message,
        added: result.added,
        total: result.total,
      });
    } catch (error: any) {
      logger.error("處理時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * 定時任務：每 30 分鐘檢查一次 RTHK 即時新聞
 * 自動獲取與火災相關的新聞並添加到 Firestore
 */
export const checkRTHKNews = onSchedule(
  {
    schedule: "*/30 * * * *", // 每 30 分鐘執行一次
    timeZone: "Asia/Hong_Kong",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    logger.info("開始檢查 RTHK 即時新聞...");

    try {
      const result = await fetchAndAddRTHKNews();
      logger.info(`✅ ${result.message}`);
    } catch (error: any) {
      logger.error("處理 RTHK 新聞時發生錯誤:", error);
      throw error;
    }
  }
);

/**
 * 手動觸發檢查 RTHK 新聞（用於測試）
 * 訪問: https://[region]-[project-id].cloudfunctions.net/manualCheckRTHKNews
 */
export const manualCheckRTHKNews = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    logger.info("手動觸發檢查 RTHK 即時新聞...");

    try {
      const result = await fetchAndAddRTHKNews();
      res.json({
        success: result.success,
        message: result.message,
        added: result.added,
        total: result.total,
      });
    } catch (error: any) {
      logger.error("處理時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * Google News 定時任務已取消
 * 如需使用，請使用手動觸發端點 manualCheckGoogleNews
 */
// export const checkGoogleNews = onSchedule(
//   {
//     schedule: "*/30 * * * *", // 每 30 分鐘執行一次
//     timeZone: "Asia/Hong_Kong",
//     memory: "512MiB",
//     timeoutSeconds: 540,
//   },
//   async (event) => {
//     logger.info("開始檢查 Google News...");

//     try {
//       const result = await fetchAndAddGoogleNews();
//       logger.info(`✅ ${result.message}`);
//     } catch (error: any) {
//       logger.error("處理 Google News 時發生錯誤:", error);
//       throw error;
//     }
//   }
// );

/**
 * 手動觸發檢查 Google News（用於測試）
 * 訪問: https://[region]-[project-id].cloudfunctions.net/manualCheckGoogleNews
 */
export const manualCheckGoogleNews = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    logger.info("手動觸發檢查 Google News...");

    try {
      const result = await fetchAndAddGoogleNews();
      res.json({
        success: result.success,
        message: result.message,
        added: result.added,
        total: result.total,
      });
    } catch (error: any) {
      logger.error("處理時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * 重新分類新聞（管理員功能）
 * 使用 AI 重新分析新聞並更新分類
 */
export const reclassifyNews = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    // 處理 CORS 預檢請求
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Max-Age", "3600");
      res.status(204).send("");
      return;
    }

    // 設置 CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // 驗證請求方法
    if (req.method !== "POST") {
      res.status(405).json({
        success: false,
        error: "只支持 POST 請求",
      });
      return;
    }

    try {
      // 驗證身份（檢查 Authorization header）
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
          success: false,
          error: "未授權：請先登入",
        });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error: any) {
        logger.warn("Token 驗證失敗:", error.message);
        res.status(401).json({
          success: false,
          error: "未授權：無效的登入憑證",
        });
        return;
      }

      const { newsId } = req.body;

      if (!newsId || typeof newsId !== "string") {
        res.status(400).json({
          success: false,
          error: "缺少 newsId 參數",
        });
        return;
      }

      logger.info(`開始重新分類新聞: ${newsId} (用戶: ${decodedToken.uid})`);

      // 獲取新聞文檔
      const newsRef = db.collection("news").doc(newsId);
      const newsDoc = await newsRef.get();

      if (!newsDoc.exists) {
        res.status(404).json({
          success: false,
          error: "找不到指定的新聞",
        });
        return;
      }

      const newsData = newsDoc.data();
      if (!newsData) {
        res.status(404).json({
          success: false,
          error: "新聞數據為空",
        });
        return;
      }

      const title = newsData.title || "";
      const content = newsData.content || "";

      if (!title && !content) {
        res.status(400).json({
          success: false,
          error: "新聞標題和內容為空，無法分類",
        });
        return;
      }

      // 使用 AI 重新分類
      logger.info(`使用 AI 重新分類新聞: "${title}"`);
      const newCategory = await classifyNewsWithAI(title, content);

      // 更新 Firestore
      await newsRef.update({
        newsCategory: newCategory,
      });

      logger.info(`✅ 新聞重新分類成功: ${newsId} -> ${newCategory}`);

      res.json({
        success: true,
        message: "重新分類成功",
        newsId,
        oldCategory: newsData.newsCategory || null,
        newCategory,
      });
    } catch (error: any) {
      logger.error("重新分類新聞時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message || "重新分類失敗",
      });
    }
  }
);

/**
 * 定時任務：每 2 小時從維基百科更新一次事件統計
 * 作為新聞抓取的補充，確保統計數據及時更新
 */
export const updateEventStats = onSchedule(
  {
    schedule: "0 */2 * * *", // 每 2 小時執行一次
    timeZone: "Asia/Hong_Kong",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    logger.info("開始從維基百科更新事件統計...");

    try {
      const result = await updateEventStatsFromWikipedia();
      logger.info(`✅ ${result.message}`);
    } catch (error: any) {
      logger.error("更新事件統計時發生錯誤:", error);
      throw error;
    }
  }
);

/**
 * 手動觸發更新事件統計（用於測試）
 * 訪問: https://[region]-[project-id].cloudfunctions.net/manualUpdateEventStats
 */
export const manualUpdateEventStats = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 300,
    cors: true,
  },
  async (req, res) => {
    logger.info("手動觸發更新事件統計...");

    try {
      const result = await updateEventStatsFromWikipedia();
      res.json({
        success: result.success,
        message: result.message,
        stats: result.stats,
      });
    } catch (error: any) {
      logger.error("處理時發生錯誤:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);
