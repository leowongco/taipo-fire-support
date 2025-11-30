/**
 * 初始化事件統計數據
 * 使用方式：npm run init:event-stats
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
import { resolve } from 'path'

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

async function initEventStats() {
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

    // 設置事件開始時間（宏福苑大火發生時間：2025年11月26日 14:51）
    // 根據維基百科：https://zh.wikipedia.org/zh-hk/宏福苑大火
    const eventStartDate = new Date('2025-11-26T14:51:00+08:00')

    // 創建初始統計數據
    const eventStats = {
      eventStartDate: Timestamp.fromDate(eventStartDate),
      casualties: 0, // 死亡人數，可以手動更新
      injured: 0,    // 受傷人數，可以手動更新
      missing: 0,    // 失蹤人數，可以手動更新
      lastUpdated: Timestamp.now(),
      source: '手動初始化',
    }

    console.log('📊 正在創建事件統計數據...')
    console.log('事件開始時間:', eventStartDate.toLocaleString('zh-HK'))
    console.log('統計數據:', {
      死亡人數: eventStats.casualties,
      受傷人數: eventStats.injured,
      失蹤人數: eventStats.missing,
    })

    await addDoc(collection(db, 'eventStats'), eventStats)
    console.log('✅ 事件統計數據創建成功！')
    console.log('💡 提示：你可以在管理後台手動更新統計數據，或等待新聞抓取器自動提取')

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 初始化失敗:', error.message)
    if (error.code === 'permission-denied') {
      console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
    }
    process.exit(1)
  }
}

initEventStats()

