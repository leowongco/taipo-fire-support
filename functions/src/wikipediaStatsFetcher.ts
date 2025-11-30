/**
 * 從維基百科獲取事件統計數據
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { load } from "cheerio";
import { updateEventStatsWithValidation } from "./statValidator";
import { CasualtyStats } from "./statExtractor";

// 延遲獲取 Firestore 實例
function getDb() {
  return admin.firestore();
}

/**
 * 從維基百科提取統計數據
 */
async function fetchWikipediaStats(): Promise<{
  casualties: number;
  injured: number;
  missing: number;
}> {
  try {
    const url = "https://zh.wikipedia.org/zh-hk/宏福苑大火";
    logger.info(`📖 正在從維基百科獲取數據: ${url}`);

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

    let casualties = 0;
    let injured = 0;
    let missing = 0;

    // 在維基百科頁面中查找統計數據
    const text = $("body").text();

    // 提取死亡人數（多種模式）
    const deathPatterns = [
      /死亡[：:]\s*(\d+)/,
      /(\d+)\s*人\s*死亡/,
      /死亡\s*(\d+)\s*人/,
      /(\d+)\s*名\s*死者/,
      /死者[：:]\s*(\d+)/,
    ];

    for (const pattern of deathPatterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > casualties) {
          casualties = num;
        }
      }
    }

    // 提取受傷人數
    const injuredPatterns = [
      /受傷[：:]\s*(\d+)/,
      /(\d+)\s*人\s*受傷/,
      /受傷\s*(\d+)\s*人/,
      /(\d+)\s*名\s*傷者/,
      /傷者[：:]\s*(\d+)/,
      /送院[：:]\s*(\d+)/,
    ];

    for (const pattern of injuredPatterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > injured) {
          injured = num;
        }
      }
    }

    // 提取失蹤人數
    const missingPatterns = [
      /失蹤[：:]\s*(\d+)/,
      /(\d+)\s*人\s*失蹤/,
      /失蹤\s*(\d+)\s*人/,
      /(\d+)\s*名\s*失蹤者/,
      /失蹤者[：:]\s*(\d+)/,
      /失聯[：:]\s*(\d+)/,
    ];

    for (const pattern of missingPatterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > missing) {
          missing = num;
        }
      }
    }

    logger.info(
      `📊 從維基百科提取的統計數據: 死亡 ${casualties}, 受傷 ${injured}, 失蹤 ${missing}`
    );

    return { casualties, injured, missing };
  } catch (error: any) {
    logger.error(`❌ 從維基百科提取數據失敗: ${error.message}`);
    throw error;
  }
}

/**
 * 從維基百科更新事件統計
 */
export async function updateEventStatsFromWikipedia(): Promise<{
  success: boolean;
  message: string;
  stats?: { casualties: number; injured: number; missing: number };
}> {
  try {
    const stats = await fetchWikipediaStats();

    // 檢查是否有統計數據
    if (stats.casualties === 0 && stats.injured === 0 && stats.missing === 0) {
      return {
        success: false,
        message: "未從維基百科提取到統計數據",
      };
    }

    const db = getDb();
    const timestamp = admin.firestore.Timestamp.now();

    // 檢查是否已有事件統計數據
    const statsSnapshot = await db.collection("eventStats").limit(1).get();

    if (statsSnapshot.empty) {
      // 如果沒有，創建新的
      const eventStartDate = new Date("2025-11-26T14:51:00+08:00");
      await db.collection("eventStats").add({
        eventStartDate: admin.firestore.Timestamp.fromDate(eventStartDate),
        casualties: stats.casualties,
        injured: stats.injured,
        missing: stats.missing,
        lastUpdated: timestamp,
        source: "維基百科",
        verifiedSources: ["維基百科"],
      });

      logger.info(
        `✅ 已創建事件統計數據（來源：維基百科）: 死亡 ${stats.casualties}, 受傷 ${stats.injured}, 失蹤 ${stats.missing}`
      );
    } else {
      // 使用驗證器更新，維基百科作為一個來源參與互相制衡機制
      // 轉換為 CasualtyStats 格式以使用驗證器
      const casualtyStats: CasualtyStats = {
        found: stats.casualties > 0 || stats.injured > 0 || stats.missing > 0,
        casualties: stats.casualties,
        injured: stats.injured,
        missing: stats.missing,
      };

      // 使用驗證器更新（維基百科作為一個來源，需要至少 2 個來源確認）
      await updateEventStatsWithValidation(
        casualtyStats,
        "維基百科",
        timestamp
      );

      logger.info(
        `✅ 已使用驗證器更新事件統計數據（來源：維基百科，參與互相制衡機制）: 死亡 ${stats.casualties}, 受傷 ${stats.injured}, 失蹤 ${stats.missing}`
      );
    }

    return {
      success: true,
      message: `成功從維基百科更新事件統計: 死亡 ${stats.casualties}, 受傷 ${stats.injured}, 失蹤 ${stats.missing}`,
      stats,
    };
  } catch (error: any) {
    logger.error(`❌ 更新事件統計失敗: ${error.message}`);
    return {
      success: false,
      message: `更新失敗: ${error.message}`,
    };
  }
}

