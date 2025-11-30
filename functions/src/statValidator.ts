/**
 * 統計數據驗證器
 * 實現多來源驗證機制，只有當多個來源確認時才更新統計數據
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { CasualtyStats } from "./statExtractor";

// 延遲獲取 Firestore 實例（避免在模組加載時初始化）
function getDb() {
  return admin.firestore();
}

// 需要至少多少個來源確認才能更新統計數據
const MIN_SOURCES_REQUIRED = 2;

/**
 * 更新事件統計數據（帶多來源驗證）
 * @param stats 提取的統計數據
 * @param source 數據來源（新聞標題或來源名稱）
 * @param timestamp 時間戳
 */
export async function updateEventStatsWithValidation(
  stats: CasualtyStats,
  source: string,
  timestamp: admin.firestore.Timestamp
): Promise<void> {
  try {
    const db = getDb();
    // 獲取現有統計數據
    const statsSnapshot = await db.collection("eventStats").limit(1).get();

    if (statsSnapshot.empty) {
      // 如果沒有現有數據，創建新文檔（但標記為未驗證）
      await db.collection("eventStats").add({
        casualties: 0,
        injured: 0,
        missing: 0,
        eventStartDate: timestamp,
        lastUpdated: timestamp,
        source: "待驗證",
        verifiedSources: [],
        pendingUpdates: {
          casualties: stats.casualties > 0 ? { value: stats.casualties, sources: [source] } : undefined,
          injured: stats.injured > 0 ? { value: stats.injured, sources: [source] } : undefined,
          missing: stats.missing > 0 ? { value: stats.missing, sources: [source] } : undefined,
        },
      });
      logger.info(
        `📊 創建新的事件統計數據（待驗證）: 死亡 ${stats.casualties}, 受傷 ${stats.injured}, 失蹤 ${stats.missing} (來源: ${source})`
      );
      return;
    }

    // 更新現有數據
    const existingDoc = statsSnapshot.docs[0];
    const existingData = existingDoc.data();
    const existingStats = {
      casualties: existingData.casualties || 0,
      injured: existingData.injured || 0,
      missing: existingData.missing || 0,
    };

    const pendingUpdates = existingData.pendingUpdates || {};
    const verifiedSources = existingData.verifiedSources || [];

    let hasChanges = false;
    const finalStats = { ...existingStats };
    const finalPendingUpdates = { ...pendingUpdates };

    // 處理死亡人數
    if (stats.casualties > 0) {
      const currentValue = existingStats.casualties;
      const newValue = Math.max(currentValue, stats.casualties);

      if (newValue > currentValue) {
        // 檢查是否有待驗證的更新
        if (pendingUpdates.casualties) {
          const pendingValue = pendingUpdates.casualties.value;
          // 如果新值與待驗證值相同或更大，添加來源
          if (newValue >= pendingValue) {
            const sources = [...new Set([...pendingUpdates.casualties.sources, source])];
            // 使用較大的值
            const finalValue = Math.max(newValue, pendingValue);
            finalPendingUpdates.casualties = { value: finalValue, sources };

            // 如果達到最小來源數，確認更新
            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.casualties = finalValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.casualties;
              hasChanges = true;
              logger.info(
                `✅ 死亡人數已驗證並更新: ${finalValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 死亡人數待驗證: ${finalValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          } else {
            // 新值小於待驗證值，但添加來源（可能新來源的數據較舊）
            const sources = [...new Set([...pendingUpdates.casualties.sources, source])];
            finalPendingUpdates.casualties = { value: pendingValue, sources };
            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.casualties = pendingValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.casualties;
              hasChanges = true;
              logger.info(
                `✅ 死亡人數已驗證並更新: ${pendingValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 死亡人數待驗證: ${pendingValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          }
        } else {
          // 創建新的待驗證更新
          finalPendingUpdates.casualties = { value: newValue, sources: [source] };
          logger.info(
            `📝 死亡人數待驗證: ${newValue} (來源: ${source}, 需要 ${MIN_SOURCES_REQUIRED} 個來源確認)`
          );
        }
      } else if (newValue === currentValue && currentValue > 0) {
        // 如果值相同且已有確認值，可以添加到已驗證來源
        if (!verifiedSources.includes(source)) {
          verifiedSources.push(source);
          hasChanges = true;
        }
      }
    }

    // 處理受傷人數
    if (stats.injured > 0) {
      const currentValue = existingStats.injured;
      const newValue = Math.max(currentValue, stats.injured);

      if (newValue > currentValue) {
        if (pendingUpdates.injured) {
          const pendingValue = pendingUpdates.injured.value;
          if (newValue >= pendingValue) {
            const sources = [...new Set([...pendingUpdates.injured.sources, source])];
            const finalValue = Math.max(newValue, pendingValue);
            finalPendingUpdates.injured = { value: finalValue, sources };

            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.injured = finalValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.injured;
              hasChanges = true;
              logger.info(
                `✅ 受傷人數已驗證並更新: ${finalValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 受傷人數待驗證: ${finalValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          } else {
            const sources = [...new Set([...pendingUpdates.injured.sources, source])];
            finalPendingUpdates.injured = { value: pendingValue, sources };
            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.injured = pendingValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.injured;
              hasChanges = true;
              logger.info(
                `✅ 受傷人數已驗證並更新: ${pendingValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 受傷人數待驗證: ${pendingValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          }
        } else {
          finalPendingUpdates.injured = { value: newValue, sources: [source] };
          logger.info(
            `📝 受傷人數待驗證: ${newValue} (來源: ${source}, 需要 ${MIN_SOURCES_REQUIRED} 個來源確認)`
          );
        }
      } else if (newValue === currentValue && currentValue > 0) {
        if (!verifiedSources.includes(source)) {
          verifiedSources.push(source);
          hasChanges = true;
        }
      }
    }

    // 處理失蹤人數
    if (stats.missing > 0) {
      const currentValue = existingStats.missing;
      const newValue = Math.max(currentValue, stats.missing);

      if (newValue > currentValue) {
        if (pendingUpdates.missing) {
          const pendingValue = pendingUpdates.missing.value;
          if (newValue >= pendingValue) {
            const sources = [...new Set([...pendingUpdates.missing.sources, source])];
            const finalValue = Math.max(newValue, pendingValue);
            finalPendingUpdates.missing = { value: finalValue, sources };

            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.missing = finalValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.missing;
              hasChanges = true;
              logger.info(
                `✅ 失蹤人數已驗證並更新: ${finalValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 失蹤人數待驗證: ${finalValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          } else {
            const sources = [...new Set([...pendingUpdates.missing.sources, source])];
            finalPendingUpdates.missing = { value: pendingValue, sources };
            if (sources.length >= MIN_SOURCES_REQUIRED) {
              finalStats.missing = pendingValue;
              verifiedSources.push(...sources.filter((s) => !verifiedSources.includes(s)));
              delete finalPendingUpdates.missing;
              hasChanges = true;
              logger.info(
                `✅ 失蹤人數已驗證並更新: ${pendingValue} (來源: ${sources.join(", ")})`
              );
            } else {
              logger.info(
                `⏳ 失蹤人數待驗證: ${pendingValue} (已確認來源: ${sources.length}/${MIN_SOURCES_REQUIRED})`
              );
            }
          }
        } else {
          finalPendingUpdates.missing = { value: newValue, sources: [source] };
          logger.info(
            `📝 失蹤人數待驗證: ${newValue} (來源: ${source}, 需要 ${MIN_SOURCES_REQUIRED} 個來源確認)`
          );
        }
      } else if (newValue === currentValue && currentValue > 0) {
        if (!verifiedSources.includes(source)) {
          verifiedSources.push(source);
          hasChanges = true;
        }
      }
    }

    // 更新文檔
    const updateData: any = {
      lastUpdated: admin.firestore.Timestamp.now(),
      verifiedSources: [...new Set(verifiedSources)],
      pendingUpdates: Object.keys(finalPendingUpdates).length > 0 ? finalPendingUpdates : admin.firestore.FieldValue.delete(),
    };

    // 只有在有確認的更新時才更新統計數據
    if (hasChanges) {
      updateData.casualties = finalStats.casualties;
      updateData.injured = finalStats.injured;
      updateData.missing = finalStats.missing;
      updateData.source = verifiedSources.join(", ");
    }

    await existingDoc.ref.update(updateData);

    if (hasChanges) {
      logger.info(
        `✅ 事件統計已更新: 死亡 ${finalStats.casualties}, 受傷 ${finalStats.injured}, 失蹤 ${finalStats.missing}`
      );
    }
  } catch (error: any) {
    logger.error(`更新事件統計數據時發生錯誤: ${error.message}`);
  }
}

