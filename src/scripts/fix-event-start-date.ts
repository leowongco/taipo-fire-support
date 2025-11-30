/**
 * 修復事件開始日期
 * 使用方式：npm run fix:event-start-date
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore'
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

async function fixEventStartDate() {
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

    // 獲取所有事件統計數據
    const statsSnapshot = await getDocs(collection(db, 'eventStats'))
    
    if (statsSnapshot.empty) {
      console.log('⚠️  沒有找到事件統計數據')
      process.exit(0)
    }

    // 正確的事件開始時間：2025年11月26日 14:51
    const correctStartDate = new Date('2025-11-26T14:51:00+08:00')
    console.log(`📅 正確的事件開始時間: ${correctStartDate.toLocaleString('zh-HK')}`)

    let updatedCount = 0

    // 更新所有事件統計數據
    for (const docSnapshot of statsSnapshot.docs) {
      const data = docSnapshot.data()
      const currentStartDate = data.eventStartDate?.toDate()
      
      if (currentStartDate) {
        console.log(`\n📊 檢查文檔 ${docSnapshot.id}:`)
        console.log(`   當前開始時間: ${currentStartDate.toLocaleString('zh-HK')}`)
        
        // 檢查日期是否錯誤（如果是 2024 年或更早）
        if (currentStartDate.getFullYear() < 2025 || 
            (currentStartDate.getFullYear() === 2025 && currentStartDate.getMonth() < 10) ||
            (currentStartDate.getFullYear() === 2025 && currentStartDate.getMonth() === 10 && currentStartDate.getDate() < 26)) {
          console.log(`   ⚠️  發現錯誤日期，正在更新...`)
          
          await updateDoc(doc(db, 'eventStats', docSnapshot.id), {
            eventStartDate: Timestamp.fromDate(correctStartDate),
            lastUpdated: Timestamp.now(),
          })
          
          console.log(`   ✅ 已更新為: ${correctStartDate.toLocaleString('zh-HK')}`)
          updatedCount++
        } else {
          console.log(`   ✓ 日期正確，無需更新`)
        }
      } else {
        // 如果沒有開始時間，添加一個
        console.log(`\n📊 文檔 ${docSnapshot.id} 缺少開始時間，正在添加...`)
        await updateDoc(doc(db, 'eventStats', docSnapshot.id), {
          eventStartDate: Timestamp.fromDate(correctStartDate),
          lastUpdated: Timestamp.now(),
        })
        console.log(`   ✅ 已添加開始時間: ${correctStartDate.toLocaleString('zh-HK')}`)
        updatedCount++
      }
    }

    console.log(`\n✅ 完成！`)
    console.log(`   更新了 ${updatedCount} 個文檔`)
    console.log(`   所有事件統計數據的事件開始時間已設置為: ${correctStartDate.toLocaleString('zh-HK')}`)

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 修復失敗:', error.message)
    if (error.code === 'permission-denied') {
      console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
    }
    process.exit(1)
  }
}

fixEventStartDate()

