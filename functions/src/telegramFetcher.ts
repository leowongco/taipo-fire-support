/**
 * Telegram 頻道消息獲取工具
 * 使用 Telegram Bot API 獲取公開頻道的消息
 */

import * as logger from 'firebase-functions/logger'

export interface TelegramMessage {
  message_id: number
  text: string
  date: number
  chat: {
    id: number
    title: string
    username?: string
  }
}

export interface TelegramUpdate {
  update_id: number
  channel_post?: TelegramMessage
  message?: TelegramMessage
}

/**
 * 使用 Telegram Bot API 獲取頻道最新消息
 * 注意：Bot 需要先加入頻道作為管理員，或者使用公開頻道的 RSS feed
 */
export async function fetchTelegramChannelMessages(
  botToken: string,
  channelUsername: string,
  limit: number = 10
): Promise<TelegramMessage[]> {
  try {
    // 方法1: 使用 getUpdates（需要 bot 在頻道中）
    // 這需要 bot 先加入頻道
    const updatesUrl = `https://api.telegram.org/bot${botToken}/getUpdates?limit=${limit}`
    
    const response = await fetch(updatesUrl)
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`)
    }

    const messages: TelegramMessage[] = []
    
    // 過濾出指定頻道的消息
    for (const update of data.result || []) {
      const message = update.channel_post || update.message
      if (message && message.chat.username === channelUsername.replace('@', '')) {
        if (message.text) {
          messages.push(message)
        }
      }
    }

    return messages
  } catch (error) {
    logger.error('Error fetching Telegram messages:', error)
    throw error
  }
}

/**
 * 使用公開頻道的 RSS feed 獲取消息（如果可用）
 * Telegram 公開頻道通常有 RSS feed: https://t.me/s/{channel_username}
 */
export async function fetchTelegramChannelViaRSS(
  channelUsername: string
): Promise<Array<{ text: string; date: number; link: string }>> {
  try {
    // Telegram 公開頻道的網頁版本
    const rssUrl = `https://t.me/s/${channelUsername.replace('@', '')}`
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.statusText}`)
    }

    // 簡單的 HTML 解析（實際使用中建議使用 cheerio 或類似的庫）
    // 這裡返回空數組，實際實現需要解析 HTML
    await response.text() // 讀取響應但不使用（待實現）
    logger.warn('RSS parsing not fully implemented, using HTML scraping fallback')
    
    return []
  } catch (error) {
    logger.error('Error fetching Telegram RSS:', error)
    return []
  }
}

/**
 * 使用 Telegram 公開頻道網頁版獲取消息
 * 這是一個備用方案，不依賴 Bot API
 */
export async function scrapeTelegramChannel(
  channelUsername: string,
  limit: number = 10
): Promise<Array<{ text: string; date: number; messageId: number; link: string }>> {
  try {
    const channelUrl = `https://t.me/s/${channelUsername.replace('@', '')}`
    
    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.statusText}`)
    }

    const html = await response.text()
    
    // 使用正則表達式提取消息（Telegram 網頁版的結構）
    const messages: Array<{ text: string; date: number; messageId: number; link: string }> = []
    
    // 提取消息 ID
    const messageIdPattern = /data-post="([^"]+)"/g
    const messageIds: string[] = []
    let match
    
    while ((match = messageIdPattern.exec(html)) !== null && messageIds.length < limit) {
      messageIds.push(match[1])
    }

    // 為每個消息 ID 提取文本內容
    for (const messageId of messageIds) {
      // 提取消息文本（Telegram 網頁版的消息通常在 <div class="tgme_widget_message_text"> 中）
      const messageTextPattern = new RegExp(
        `data-post="${messageId}"[\\s\\S]*?<div class="tgme_widget_message_text"[^>]*>([\\s\\S]*?)<\\/div>`,
        'i'
      )
      const textMatch = html.match(messageTextPattern)
      
      let text = ''
      if (textMatch && textMatch[1]) {
        // 移除 HTML 標籤
        text = textMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim()
      }

      // 提取時間戳
      const timePattern = new RegExp(
        `data-post="${messageId}"[\\s\\S]*?<time[^>]*datetime="([^"]+)"`,
        'i'
      )
      const timeMatch = html.match(timePattern)
      const date = timeMatch && timeMatch[1] 
        ? new Date(timeMatch[1]).getTime() / 1000
        : Date.now() / 1000

      if (text) {
        messages.push({
          text,
          date: Math.floor(date),
          messageId: parseInt(messageId) || 0,
          link: `https://t.me/${channelUsername.replace('@', '')}/${messageId}`,
        })
      }
    }

    logger.info(`從網頁版獲取到 ${messages.length} 條消息`)
    return messages
  } catch (error) {
    logger.error('Error scraping Telegram channel:', error)
    return []
  }
}

