/**
 * 從新聞文本中提取死傷失蹤統計數據
 */

import * as logger from "firebase-functions/logger";

export interface CasualtyStats {
  casualties: number; // 死亡人數
  injured: number; // 受傷人數
  missing: number; // 失蹤人數
  found: boolean; // 是否找到相關數據
}

/**
 * 從文本中提取死傷失蹤統計數據
 * @param text 新聞文本內容
 * @returns 統計數據對象
 */
export function extractCasualtyStats(text: string): CasualtyStats {
  const stats: CasualtyStats = {
    casualties: 0,
    injured: 0,
    missing: 0,
    found: false,
  };

  if (!text || text.trim().length === 0) {
    return stats;
  }

  // 統一轉換為小寫以便匹配
  const lowerText = text.toLowerCase();

  // 死亡人數匹配模式
  const deathPatterns = [
    /(\d+)\s*人\s*死亡/g,
    /死亡\s*(\d+)\s*人/g,
    /(\d+)\s*人\s*喪生/g,
    /喪生\s*(\d+)\s*人/g,
    /(\d+)\s*人\s*罹難/g,
    /罹難\s*(\d+)\s*人/g,
    /(\d+)\s*名\s*死者/g,
    /死者\s*(\d+)\s*名/g,
    /(\d+)\s*人\s*不治/g,
    /不治\s*(\d+)\s*人/g,
  ];

  // 受傷人數匹配模式
  const injuredPatterns = [
    /(\d+)\s*人\s*受傷/g,
    /受傷\s*(\d+)\s*人/g,
    /(\d+)\s*人\s*送院/g,
    /送院\s*(\d+)\s*人/g,
    /(\d+)\s*名\s*傷者/g,
    /傷者\s*(\d+)\s*名/g,
    /(\d+)\s*人\s*送醫/g,
    /送醫\s*(\d+)\s*人/g,
  ];

  // 失蹤人數匹配模式
  const missingPatterns = [
    /(\d+)\s*人\s*失蹤/g,
    /失蹤\s*(\d+)\s*人/g,
    /(\d+)\s*人\s*失聯/g,
    /失聯\s*(\d+)\s*人/g,
    /(\d+)\s*人\s*下落不明/g,
    /下落不明\s*(\d+)\s*人/g,
    /(\d+)\s*名\s*失蹤者/g,
    /失蹤者\s*(\d+)\s*名/g,
  ];

  // 提取死亡人數
  for (const pattern of deathPatterns) {
    const matches = [...lowerText.matchAll(pattern)];
    for (const match of matches) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > stats.casualties) {
        stats.casualties = num;
        stats.found = true;
      }
    }
  }

  // 提取受傷人數
  for (const pattern of injuredPatterns) {
    const matches = [...lowerText.matchAll(pattern)];
    for (const match of matches) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > stats.injured) {
        stats.injured = num;
        stats.found = true;
      }
    }
  }

  // 提取失蹤人數
  for (const pattern of missingPatterns) {
    const matches = [...lowerText.matchAll(pattern)];
    for (const match of matches) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > stats.missing) {
        stats.missing = num;
        stats.found = true;
      }
    }
  }

  // 如果找到任何數據，記錄日誌
  if (stats.found) {
    logger.info(
      `提取到統計數據: 死亡 ${stats.casualties} 人, 受傷 ${stats.injured} 人, 失蹤 ${stats.missing} 人`
    );
  }

  return stats;
}

/**
 * 從新聞標題和內容中提取事件發生時間
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 事件發生時間（如果找到），否則返回 null
 */
export function extractEventStartDate(
  title: string,
  content: string
): Date | null {
  const text = `${title} ${content}`;

  // 匹配日期模式：2024年11月26日、2024/11/26、26/11/2024 等
  const datePatterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
  ];

  // 查找最早的事件相關日期
  let earliestDate: Date | null = null;

  for (const pattern of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      try {
        let year: number, month: number, day: number;

        if (match[0].includes("年")) {
          // 中文日期格式：2024年11月26日
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
        } else if (match[1].length === 4) {
          // YYYY/MM/DD 格式
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
        } else {
          // DD/MM/YYYY 格式
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        }

        // 驗證日期有效性
        if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            // 只考慮合理的日期（不超過今天）
            if (date <= new Date()) {
              if (!earliestDate || date < earliestDate) {
                earliestDate = date;
              }
            }
          }
        }
      } catch (error) {
        // 忽略解析錯誤
        continue;
      }
    }
  }

  return earliestDate;
}

/**
 * 從新聞內容中自動分類新聞類型
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 新聞分類
 */
export function classifyNewsCategory(
  title: string,
  content: string
): "financial" | "emotional" | "government" | "industry" | "general" | "urgent" {
  const text = `${title} ${content}`.toLowerCase();

  // 財政支援關鍵詞
  const financialKeywords = [
    "資助",
    "補助",
    "津貼",
    "賠償",
    "基金",
    "捐款",
    "財政",
    "經濟",
    "金錢",
    "現金",
    "援助金",
    "應急基金",
  ];

  // 情緒支援關鍵詞
  const emotionalKeywords = [
    "心理",
    "輔導",
    "情緒",
    "支援",
    "社工",
    "輔導員",
    "心理醫生",
    "精神健康",
    "創傷",
    "哀傷",
    "輔導服務",
  ];

  // 政府支援關鍵詞
  const governmentKeywords = [
    "政府",
    "民政",
    "社會福利署",
    "消防處",
    "警務處",
    "政府部門",
    "官方",
    "公營",
  ];

  // 業界支援關鍵詞
  const industryKeywords = [
    "商會",
    "企業",
    "公司",
    "機構",
    "組織",
    "非政府",
    "ngo",
    "慈善",
    "義工",
    "志願",
  ];

  // 緊急關鍵詞
  const urgentKeywords = [
    "緊急",
    "即時",
    "立即",
    "火警",
    "火災",
    "撤離",
    "疏散",
  ];

  // 檢查緊急
  if (urgentKeywords.some((keyword) => text.includes(keyword))) {
    return "urgent";
  }

  // 檢查財政支援
  if (financialKeywords.some((keyword) => text.includes(keyword))) {
    return "financial";
  }

  // 檢查情緒支援
  if (emotionalKeywords.some((keyword) => text.includes(keyword))) {
    return "emotional";
  }

  // 檢查政府支援
  if (governmentKeywords.some((keyword) => text.includes(keyword))) {
    return "government";
  }

  // 檢查業界支援
  if (industryKeywords.some((keyword) => text.includes(keyword))) {
    return "industry";
  }

  // 默認為一般新聞
  return "general";
}

