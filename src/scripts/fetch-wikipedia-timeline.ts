/**
 * 從維基百科提取宏福苑大火時間軸資料
 * 使用方式：npm run fetch:wikipedia-timeline
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, Timestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
import { resolve } from 'path'
import * as cheerio from 'cheerio'

// 載入環境變量
dotenv.config({ path: resolve(process.cwd(), '.env') })

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  throw new Error('請確保 .env 文件中已設置所有 Firebase 配置變量')
}

console.log(`📋 使用 Firebase 項目: ${firebaseConfig.projectId}`)

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

interface TimelineEvent {
  date: Date
  title: string
  content: string
  category: 'milestone' | 'news' | 'summary'
  tags: string[]
  importance: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * 從維基百科提取時間軸數據
 */
async function fetchWikipediaTimeline(): Promise<TimelineEvent[]> {
  try {
    const url = 'https://zh.wikipedia.org/zh-hk/宏福苑大火'
    console.log(`📖 正在從維基百科獲取時間軸數據: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const timelineEvents: TimelineEvent[] = []
    
    // 查找「經過」或「時間線」章節
    // 維基百科通常使用 h2 標題和列表結構
    let inTimelineSection = false
    let currentDate: Date | null = null
    
    // 查找所有標題和內容
    $('h2, h3, ul, ol').each((_, element) => {
      const $el = $(element)
      const text = $el.text().trim()
      
      // 檢查是否進入時間軸章節
      if ($el.is('h2, h3')) {
        if (text.includes('經過') || text.includes('時間線') || text.includes('救援時間線')) {
          inTimelineSection = true
          console.log(`✅ 找到時間軸章節: ${text}`)
          return
        }
        if (inTimelineSection && (text.includes('影響') || text.includes('應對') || text.includes('爭議'))) {
          inTimelineSection = false
          return
        }
      }
      
      if (!inTimelineSection) return
      
      // 解析日期標題（例如：11月26日、11月27日）
      if ($el.is('h3, h4')) {
        const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日/)
        if (dateMatch) {
          const month = parseInt(dateMatch[1], 10)
          const day = parseInt(dateMatch[2], 10)
          currentDate = new Date(2025, month - 1, day, 14, 51, 0) // 使用事件開始時間作為默認時間
          console.log(`📅 找到日期: ${month}月${day}日`)
        }
      }
      
      // 解析列表項（時間軸事件）
      if ($el.is('ul, ol') && currentDate) {
        $el.find('li').each((_, li) => {
          const $li = $(li)
          const liText = $li.text().trim()
          
          if (liText.length < 10) return // 跳過太短的項目
          
          // 提取時間（例如：14:51、15:30）
          let eventTime: Date
          if (!currentDate) {
            eventTime = new Date() // 如果沒有當前日期，使用現在
          } else {
            eventTime = new Date(currentDate)
          }
          
          const timeMatch = liText.match(/(\d{1,2}):(\d{2})/)
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10)
            const minutes = parseInt(timeMatch[2], 10)
            eventTime.setHours(hours, minutes, 0, 0)
          }
          
          // 提取標題和內容
          const parts = liText.split(/[：:]/)
          const title = parts[0].trim()
          const content = parts.slice(1).join('：').trim() || title
          
          // 判斷類別和重要性
          let category: 'milestone' | 'news' | 'summary' = 'news'
          let importance: 'low' | 'medium' | 'high' | 'critical' = 'medium'
          const tags: string[] = []
          
          if (title.includes('起火') || title.includes('火警') || title.includes('五級火')) {
            category = 'milestone'
            importance = 'critical'
            tags.push('火災', '開始')
          } else if (title.includes('救熄') || title.includes('撲滅')) {
            category = 'milestone'
            importance = 'high'
            tags.push('火災', '結束')
          } else if (title.includes('死亡') || title.includes('罹難')) {
            importance = 'critical'
            tags.push('傷亡')
          } else if (title.includes('疏散') || title.includes('撤離')) {
            importance = 'high'
            tags.push('疏散')
          } else if (title.includes('救援') || title.includes('消防')) {
            importance = 'high'
            tags.push('救援')
          }
          
          timelineEvents.push({
            date: eventTime,
            title: title.length > 50 ? title.substring(0, 50) + '...' : title,
            content: content.length > 500 ? content.substring(0, 500) + '...' : content,
            category,
            tags,
            importance,
          })
        })
      }
    })
    
    // 如果沒有找到結構化的時間軸，嘗試從文本中提取
    if (timelineEvents.length === 0) {
      console.log('⚠️  未找到結構化時間軸，嘗試從文本提取...')
      const bodyText = $('body').text()
      
      // 查找日期和事件模式
      const datePattern = /(\d{1,2})月(\d{1,2})日[，,、]?\s*([^。]+)/g
      let match
      
      while ((match = datePattern.exec(bodyText)) !== null) {
        const month = parseInt(match[1], 10)
        const day = parseInt(match[2], 10)
        const eventText = match[3].trim()
        
        if (eventText.length < 10) continue
        
        const eventDate = new Date(2025, month - 1, day, 14, 51, 0)
        
        timelineEvents.push({
          date: eventDate,
          title: eventText.substring(0, 50),
          content: eventText.substring(0, 500),
          category: 'news',
          tags: ['時間軸'],
          importance: 'medium',
        })
      }
    }
    
    console.log(`📊 從維基百科提取了 ${timelineEvents.length} 個時間軸事件`)
    
    return timelineEvents
  } catch (error: any) {
    console.error('❌ 從維基百科提取時間軸失敗:', error.message)
    throw error
  }
}

async function updateHistoryRecordsFromWikipedia() {
  try {
    // 登入管理員帳號
    const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      console.error('❌ 請設置 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變量')
      process.exit(1)
    }

    console.log('🔐 正在登入管理員帳號...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('✅ 登入成功')

    // 從維基百科提取時間軸數據
    const timelineEvents = await fetchWikipediaTimeline()

    if (timelineEvents.length === 0) {
      console.log('⚠️  未找到時間軸數據')
      process.exit(0)
    }

    // 檢查現有記錄，避免重複
    const existingRecords = await getDocs(collection(db, 'historyRecords'))
    const existingTitles = new Set(
      existingRecords.docs.map(doc => doc.data().title)
    )

    let addedCount = 0
    let skippedCount = 0

    // 添加時間軸事件到 Firestore
    for (const event of timelineEvents) {
      // 跳過已存在的記錄
      if (existingTitles.has(event.title)) {
        skippedCount++
        continue
      }

      const historyRecord = {
        title: event.title,
        content: event.content,
        date: Timestamp.fromDate(event.date),
        category: event.category,
        tags: event.tags,
        importance: event.importance,
        timestamp: Timestamp.now(),
      }

      await addDoc(collection(db, 'historyRecords'), historyRecord)
      addedCount++
      console.log(`✅ 已添加: ${event.title} (${event.date.toLocaleDateString('zh-HK')})`)
    }

    console.log(`\n✅ 完成！`)
    console.log(`   新增: ${addedCount} 條記錄`)
    console.log(`   跳過: ${skippedCount} 條已存在記錄`)
    console.log(`   總計: ${timelineEvents.length} 條時間軸事件`)

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 更新失敗:', error.message)
    process.exit(1)
  }
}

updateHistoryRecordsFromWikipedia()

