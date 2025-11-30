/**
 * 從維基百科提取宏福苑大火統計數據
 * 使用方式：npm run fetch:wikipedia-stats
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore'
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

/**
 * 從維基百科提取統計數據
 */
async function fetchWikipediaStats() {
  try {
    const url = 'https://zh.wikipedia.org/zh-hk/宏福苑大火'
    console.log(`📖 正在從維基百科獲取數據: ${url}`)
    
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
    
    // 查找傷亡統計部分
    let casualties = 0
    let injured = 0
    let missing = 0
    
    // 在維基百科頁面中查找統計數據
    // 通常會在「影響」或「傷亡統計」章節中
    const text = $('body').text()
    
    // 提取死亡人數（多種模式）
    const deathPatterns = [
      /死亡[：:]\s*(\d+)/,
      /(\d+)\s*人\s*死亡/,
      /死亡\s*(\d+)\s*人/,
      /(\d+)\s*名\s*死者/,
      /死者[：:]\s*(\d+)/,
    ]
    
    for (const pattern of deathPatterns) {
      const match = text.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > casualties) {
          casualties = num
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
    ]
    
    for (const pattern of injuredPatterns) {
      const match = text.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > injured) {
          injured = num
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
    ]
    
    for (const pattern of missingPatterns) {
      const match = text.match(pattern)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > missing) {
          missing = num
        }
      }
    }
    
    console.log('📊 從維基百科提取的統計數據:')
    console.log(`  死亡人數: ${casualties}`)
    console.log(`  受傷人數: ${injured}`)
    console.log(`  失蹤人數: ${missing}`)
    
    return { casualties, injured, missing }
  } catch (error: any) {
    console.error('❌ 從維基百科提取數據失敗:', error.message)
    throw error
  }
}

async function updateEventStatsFromWikipedia() {
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

    // 從維基百科提取統計數據
    const stats = await fetchWikipediaStats()

    // 檢查是否已有事件統計數據
    const statsSnapshot = await getDocs(collection(db, 'eventStats'))
    
    if (statsSnapshot.empty) {
      // 如果沒有，創建新的
      const eventStartDate = new Date('2025-11-26T14:51:00+08:00')
      const eventStats = {
        eventStartDate: Timestamp.fromDate(eventStartDate),
        casualties: stats.casualties,
        injured: stats.injured,
        missing: stats.missing,
        lastUpdated: Timestamp.now(),
        source: '維基百科',
        verifiedSources: ['維基百科'],
      }

      await addDoc(collection(db, 'eventStats'), eventStats)
      console.log('✅ 已創建事件統計數據（來源：維基百科）')
    } else {
      // 更新現有數據
      const existingDoc = statsSnapshot.docs[0]
      const existingData = existingDoc.data()
      
      // 更新統計數據（使用維基百科作為初始參考，但保留更高的值）
      const updatedStats = {
        casualties: Math.max(existingData.casualties || 0, stats.casualties),
        injured: Math.max(existingData.injured || 0, stats.injured),
        missing: Math.max(existingData.missing || 0, stats.missing),
        lastUpdated: Timestamp.now(),
        verifiedSources: [...new Set([...(existingData.verifiedSources || []), '維基百科'])],
      }

      await updateDoc(doc(db, 'eventStats', existingDoc.id), updatedStats)
      console.log('✅ 已更新事件統計數據（來源：維基百科）')
      console.log(`   死亡: ${updatedStats.casualties}, 受傷: ${updatedStats.injured}, 失蹤: ${updatedStats.missing}`)
    }

    console.log('💡 提示：這些數據將作為初始參考，新聞抓取器會繼續驗證和更新')

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 更新失敗:', error.message)
    process.exit(1)
  }
}

updateEventStatsFromWikipedia()

