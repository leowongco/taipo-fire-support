/**
 * 格式化聯絡資訊的工具函數
 */

/**
 * 將地址轉換為 Google Maps 搜索鏈接
 * @param address 地址字符串
 * @returns Google Maps 搜索 URL
 */
export function getGoogleMapsUrl(address: string): string {
  const encodedAddress = encodeURIComponent(address)
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
}

/**
 * 從電話字符串中提取第一個電話號碼
 * @param phoneString 電話字符串（可能包含多個號碼、文字說明等）
 * @returns 提取的電話號碼（僅數字）
 */
export function extractPhoneNumber(phoneString: string): string {
  // 移除所有非數字字符，但保留開頭的 + 號
  const cleaned = phoneString.replace(/[^\d+]/g, '')
  
  // 如果包含 +852，移除它（香港區號）
  let phone = cleaned.replace(/\+852/g, '')
  
  // 提取第一個連續的數字序列（至少 8 位）
  const match = phone.match(/\d{8,}/)
  if (match) {
    return match[0]
  }
  
  // 如果沒有找到，返回清理後的字符串
  return phone.replace(/[^\d]/g, '')
}

/**
 * 格式化電話號碼為 tel: 鏈接
 * @param phoneString 電話字符串
 * @returns tel: URL
 */
export function getTelUrl(phoneString: string): string {
  const phone = extractPhoneNumber(phoneString)
  // 如果是香港號碼（8位數字），添加 852 區號
  if (phone.length === 8 && !phone.startsWith('852')) {
    return `tel:+852${phone}`
  }
  // 如果已經包含區號
  if (phone.startsWith('852')) {
    return `tel:+${phone}`
  }
  // 如果以 + 開頭
  if (phone.startsWith('+')) {
    return `tel:${phone}`
  }
  // 默認添加 +852
  return `tel:+852${phone}`
}

/**
 * 檢查是否為 WhatsApp 號碼
 * @param phoneString 電話字符串
 * @returns 是否為 WhatsApp 號碼
 */
export function isWhatsAppNumber(phoneString: string): boolean {
  const lower = phoneString.toLowerCase()
  return lower.includes('whatsapp') || 
         lower.includes('wa') || 
         phoneString.includes('6083') || 
         phoneString.includes('6316') || 
         phoneString.includes('9790') || 
         phoneString.includes('4645') ||
         phoneString.includes('5931')
}

/**
 * 格式化電話號碼為 WhatsApp 鏈接
 * @param phoneString 電話字符串
 * @returns WhatsApp URL
 */
export function getWhatsAppUrl(phoneString: string): string {
  const phone = extractPhoneNumber(phoneString)
  // WhatsApp 鏈接格式：https://wa.me/852XXXXXXXX
  // 如果是香港號碼（8位數字），添加 852 區號
  if (phone.length === 8 && !phone.startsWith('852')) {
    return `https://wa.me/852${phone}`
  }
  // 如果已經包含區號
  if (phone.startsWith('852')) {
    return `https://wa.me/${phone}`
  }
  // 如果以 + 開頭，移除 +
  if (phone.startsWith('+')) {
    return `https://wa.me/${phone.substring(1)}`
  }
  // 默認添加 852
  return `https://wa.me/852${phone}`
}

/**
 * 解析電話字符串，提取所有電話號碼
 * @param phoneString 電話字符串（可能包含多個號碼）
 * @returns 電話號碼數組
 */
export function parsePhoneNumbers(phoneString: string): Array<{ text: string; number: string; isWhatsApp: boolean }> {
  // 按常見分隔符分割（/、,、或、及等）
  const parts = phoneString.split(/[/,，、或及]/).map(p => p.trim()).filter(p => p)
  
  return parts.map(part => {
    const number = extractPhoneNumber(part)
    return {
      text: part,
      number,
      isWhatsApp: isWhatsAppNumber(part)
    }
  })
}

/**
 * 檢測是否為 Instagram 帳號
 * @param text 文本字符串
 * @returns 是否包含 Instagram 帳號
 */
export function isInstagramAccount(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('ig:') || lower.includes('instagram:') || lower.includes('@') && (lower.includes('ig') || lower.includes('instagram'))
}

/**
 * 提取 Instagram 用戶名
 * @param text 包含 Instagram 帳號的文本
 * @returns Instagram 用戶名（不含 @ 符號）或 null
 */
export function extractInstagramUsername(text: string): string | null {
  // 匹配 @username 格式
  const match = text.match(/@([a-zA-Z0-9._]+)/)
  if (match) {
    return match[1]
  }
  
  // 匹配 IG: @username 或 Instagram: @username 格式
  const igMatch = text.match(/(?:ig|instagram):\s*@?([a-zA-Z0-9._]+)/i)
  if (igMatch) {
    return igMatch[1]
  }
  
  return null
}

/**
 * 獲取 Instagram 鏈接
 * @param text 包含 Instagram 帳號的文本
 * @returns Instagram URL 或 null
 */
export function getInstagramUrl(text: string): string | null {
  const username = extractInstagramUsername(text)
  if (username) {
    return `https://www.instagram.com/${username}/`
  }
  return null
}

