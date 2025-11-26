/**
 * Telegram 貼文解析工具
 * 解析銀河系哨俠頻道的貼文，提取物資收集站和庇護中心信息
 */

export interface ParsedResource {
  locationName: string
  address: string
  mapLink: string
  category: 'supply' | 'shelter'
  status: 'open' | 'closed' | 'full'
  needs: string[]
  contact: string
  source: string
  sourceUrl?: string
}

/**
 * 從文本中提取地址
 */
function extractAddress(text: string): string {
  // 常見地址模式
  const addressPatterns = [
    /([大埔|新界|香港].*?(?:街|路|道|邨|村|中心|會堂|廣場|大廈|樓|號))/g,
    /(.*?(?:社區中心|社區會堂|體育館|活動中心|中心|會堂))/g,
  ]

  for (const pattern of addressPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  // 如果找不到完整地址，嘗試提取地點名稱
  const locationPatterns = [
    /([大埔|新界].*?(?:中心|會堂|體育館|活動中心))/g,
  ]

  for (const pattern of locationPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  return ''
}

/**
 * 從文本中提取 Google Maps 連結
 */
function extractMapLink(text: string): string {
  const mapPatterns = [
    /(https?:\/\/[^\s]*(?:maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*)/g,
    /(https?:\/\/[^\s]*(?:openstreetmap|osm)[^\s]*)/g,
  ]

  for (const pattern of mapPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  // 如果沒有找到地圖連結，嘗試根據地址生成 Google Maps 搜尋連結
  const address = extractAddress(text)
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }

  return ''
}

/**
 * 從文本中提取聯絡方式
 */
function extractContact(text: string): string {
  const phonePattern = /(\d{4}\s?\d{4}|\d{8})/g
  const matches = text.match(phonePattern)
  if (matches && matches.length > 0) {
    return matches[0].replace(/\s/g, '')
  }

  // 嘗試提取其他聯絡方式
  const contactPatterns = [
    /聯絡[：:]\s*([^\n]+)/,
    /電話[：:]\s*([^\n]+)/,
    /Contact[：:]\s*([^\n]+)/i,
  ]

  for (const pattern of contactPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return ''
}

/**
 * 從文本中提取需要的物資
 */
function extractNeeds(text: string): string[] {
  const needs: string[] = []
  
  // 常見物資關鍵字
  const supplyKeywords = [
    '水', '樽裝水', '食水', '飲用水',
    '口罩', 'N95', '外科口罩',
    '毛巾', '毛毯', '被', '毯',
    '食物', '乾糧', '餅乾', '麵包',
    '生理鹽水', '洗眼水', '眼藥水',
    '濕紙巾', '紙巾',
    '充電器', '充電寶', '行動電源',
    '手電筒', '電筒',
  ]

  for (const keyword of supplyKeywords) {
    if (text.includes(keyword)) {
      needs.push(keyword)
    }
  }

  // 嘗試從結構化文本中提取
  const needsPatterns = [
    /需要[：:]\s*([^\n]+)/,
    /物資[：:]\s*([^\n]+)/,
    /需求[：:]\s*([^\n]+)/,
  ]

  for (const pattern of needsPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const items = match[1]
        .split(/[、,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      needs.push(...items)
    }
  }

  // 去重
  return [...new Set(needs)]
}

/**
 * 判斷是物資收集站還是庇護中心
 */
function determineCategory(text: string): 'supply' | 'shelter' {
  const lowerText = text.toLowerCase()

  // 庇護中心關鍵字
  const shelterKeywords = [
    '庇護', '避難', '臨時住宿', '住宿', '過夜',
    '休息', '暫住', '收容',
  ]

  // 物資收集站關鍵字
  const supplyKeywords = [
    '物資收集', '收集站', '收集點', '捐贈',
    '物資', '收集', '捐',
  ]

  const shelterCount = shelterKeywords.filter((keyword) =>
    lowerText.includes(keyword)
  ).length
  const supplyCount = supplyKeywords.filter((keyword) =>
    lowerText.includes(keyword)
  ).length

  // 如果明確提到庇護相關，優先判斷為庇護中心
  if (shelterCount > 0 && shelterCount >= supplyCount) {
    return 'shelter'
  }

  // 默認為物資收集站
  return 'supply'
}

/**
 * 判斷狀態
 */
function determineStatus(text: string): 'open' | 'closed' | 'full' {
  const lowerText = text.toLowerCase()

  if (lowerText.includes('已滿') || lowerText.includes('滿額') || lowerText.includes('額滿')) {
    return 'full'
  }

  if (
    lowerText.includes('已關閉') ||
    lowerText.includes('關閉') ||
    lowerText.includes('停止')
  ) {
    return 'closed'
  }

  return 'open'
}

/**
 * 提取地點名稱
 */
function extractLocationName(text: string): string {
  // 嘗試提取第一行的標題
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    // 移除常見的前綴
    const cleaned = firstLine
      .replace(/^[⚠️⚠️⚠️]*\s*/, '')
      .replace(/^號外\s*/, '')
      .replace(/^注意\s*/, '')
      .trim()

    if (cleaned.length > 0 && cleaned.length < 50) {
      return cleaned
    }
  }

  // 如果第一行太長，嘗試從地址中提取
  const address = extractAddress(text)
  if (address) {
    return address
  }

  return '未命名地點'
}

/**
 * 解析 Telegram 貼文
 */
export function parseTelegramPost(
  text: string,
  messageId?: number,
  channelUsername?: string
): ParsedResource | null {
  if (!text || text.trim().length === 0) {
    return null
  }

  const locationName = extractLocationName(text)
  const address = extractAddress(text)
  const mapLink = extractMapLink(text)
  const category = determineCategory(text)
  const status = determineStatus(text)
  const needs = extractNeeds(text)
  const contact = extractContact(text)

  // 如果沒有提取到基本信息，跳過
  if (!locationName && !address) {
    return null
  }

  const sourceUrl = channelUsername
    ? `https://t.me/${channelUsername}/${messageId || ''}`
    : undefined

  return {
    locationName: locationName || address || '未命名地點',
    address: address || locationName || '',
    mapLink: mapLink || '',
    category,
    status,
    needs,
    contact,
    source: '銀河系哨俠頻道',
    sourceUrl,
  }
}

