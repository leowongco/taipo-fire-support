/**
 * 修復新聞時間戳
 * 從 RSS feed 重新獲取時間戳並更新 Firestore 中的新聞
 * 使用方式：npm run fix:news-timestamps
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
import { resolve } from 'path'
import { load } from 'cheerio'

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

// 解析 RSS 日期
function parseRSSDate(dateString: string): Date {
  try {
    return new Date(dateString)
  } catch (error) {
    console.warn(`無法解析日期: ${dateString}`)
    return new Date()
  }
}

// 從 RTHK RSS 獲取新聞的 pubDate
async function fetchRTHKNewsPubDate(url: string): Promise<Date | null> {
  try {
    const rssUrl = 'https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml'
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return null
    }

    const xml = await response.text()
    const $ = load(xml, { xmlMode: true })

    let pubDate: Date | null = null

    $('item').each((_, element) => {
      const $item = $(element)
      const link = $item.find('link').text().trim()
      const itemPubDate = $item.find('pubDate').text().trim()

      if (link === url && itemPubDate) {
        pubDate = parseRSSDate(itemPubDate)
        return false // 停止循環
      }
    })

    return pubDate
  } catch (error: any) {
    console.warn(`獲取 RTHK RSS 失敗: ${error.message}`)
    return null
  }
}

// 從政府新聞 RSS 獲取新聞的 pubDate
async function fetchGovNewsPubDate(url: string): Promise<Date | null> {
  try {
    const rssUrl = 'https://www.info.gov.hk/gia/rss/general_zh.xml'
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return null
    }

    const xml = await response.text()
    const $ = load(xml, { xmlMode: true })

    let pubDate: Date | null = null

    $('item').each((_, element) => {
      const $item = $(element)
      const link = $item.find('link').text().trim()
      const itemPubDate = $item.find('pubDate').text().trim()

      if (link === url && itemPubDate) {
        pubDate = parseRSSDate(itemPubDate)
        return false // 停止循環
      }
    })

    return pubDate
  } catch (error: any) {
    console.warn(`獲取政府新聞 RSS 失敗: ${error.message}`)
    return null
  }
}

// 從新聞頁面獲取發佈時間（備用方案）
async function fetchNewsPageTimestamp(url: string): Promise<Date | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const $ = load(html)

    // 嘗試多種可能的時間選擇器
    const timeSelectors = [
      'time[datetime]',
      '.publish-date',
      '.published-date',
      '.date',
      '[class*="date"]',
      '[class*="time"]',
    ]

    for (const selector of timeSelectors) {
      const $time = $(selector).first()
      if ($time.length > 0) {
        const datetime = $time.attr('datetime') || $time.text().trim()
        if (datetime) {
          const date = new Date(datetime)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
      }
    }

    // 嘗試從文本中提取時間（RTHK 格式：2025-11-29 HKT 23:46）
    const text = $('body').text()
    const timeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s+HKT\s+(\d{2}):(\d{2})/)
    if (timeMatch) {
      const [, dateStr, hour, minute] = timeMatch
      const date = new Date(`${dateStr}T${hour}:${minute}:00+08:00`)
      if (!isNaN(date.getTime())) {
        return date
      }
    }

    return null
  } catch (error: any) {
    console.warn(`獲取新聞頁面時間失敗: ${error.message}`)
    return null
  }
}

async function fixNewsTimestamps() {
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
    console.log('✅ 登入成功\n')

    // 獲取所有新聞
    const newsSnapshot = await getDocs(collection(db, 'news'))
    
    if (newsSnapshot.empty) {
      console.log('⚠️  沒有找到新聞')
      process.exit(0)
    }

    console.log(`📰 找到 ${newsSnapshot.size} 條新聞，開始修復時間戳...\n`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    // 處理每條新聞
    for (const docSnapshot of newsSnapshot.docs) {
      const data = docSnapshot.data()
      const title = data.title || ''
      const url = data.url || ''
      const source = data.source || ''
      const currentTimestamp = data.timestamp?.toDate()
      const newsId = docSnapshot.id

      if (!url) {
        console.log(`⏭️  跳過 ${newsId}: 沒有 URL`)
        skippedCount++
        continue
      }

      console.log(`\n📄 處理: ${title.substring(0, 50)}...`)
      console.log(`   URL: ${url}`)
      console.log(`   來源: ${source}`)
      if (currentTimestamp) {
        console.log(`   當前時間: ${currentTimestamp.toLocaleString('zh-HK')}`)
      }

      let newTimestamp: Date | null = null

      // 根據來源選擇不同的方法獲取時間戳
      if (source.includes('RTHK') || source.includes('香港電台')) {
        // 先嘗試從 RSS 獲取
        newTimestamp = await fetchRTHKNewsPubDate(url)
        if (!newTimestamp) {
          // 如果 RSS 沒有，嘗試從頁面獲取
          console.log('   RSS 中未找到，嘗試從頁面獲取...')
          newTimestamp = await fetchNewsPageTimestamp(url)
        }
      } else if (source.includes('政府') || source.includes('Gov')) {
        // 先嘗試從 RSS 獲取
        newTimestamp = await fetchGovNewsPubDate(url)
        if (!newTimestamp) {
          // 如果 RSS 沒有，嘗試從頁面獲取
          console.log('   RSS 中未找到，嘗試從頁面獲取...')
          newTimestamp = await fetchNewsPageTimestamp(url)
        }
      } else {
        // 其他來源，嘗試從頁面獲取
        newTimestamp = await fetchNewsPageTimestamp(url)
      }

      if (!newTimestamp || isNaN(newTimestamp.getTime())) {
        console.log(`   ⚠️  無法獲取時間戳，跳過`)
        skippedCount++
        continue
      }

      console.log(`   新時間: ${newTimestamp.toLocaleString('zh-HK')}`)

      // 檢查時間是否需要更新（如果時間差超過 1 小時，則更新）
      if (currentTimestamp) {
        const timeDiff = Math.abs(newTimestamp.getTime() - currentTimestamp.getTime())
        const hoursDiff = timeDiff / (1000 * 60 * 60)
        
        if (hoursDiff < 1) {
          console.log(`   ✓ 時間差異小於 1 小時，無需更新`)
          skippedCount++
          continue
        }
      }

      // 更新時間戳
      try {
        await updateDoc(doc(db, 'news', newsId), {
          timestamp: Timestamp.fromDate(newTimestamp),
        })
        console.log(`   ✅ 已更新時間戳`)
        updatedCount++
      } catch (error: any) {
        console.error(`   ❌ 更新失敗: ${error.message}`)
        errorCount++
      }

      // 添加延遲避免請求過快
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`\n✅ 完成！`)
    console.log(`   更新了 ${updatedCount} 條新聞`)
    console.log(`   跳過了 ${skippedCount} 條新聞`)
    console.log(`   錯誤 ${errorCount} 條新聞`)

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 修復失敗:', error.message)
    if (error.code === 'permission-denied') {
      console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
    }
    process.exit(1)
  }
}

fixNewsTimestamps()

