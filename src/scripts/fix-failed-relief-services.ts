/**
 * 修復遷移失敗的支援服務項目
 * 使用方式：npm run fix:failed-relief-services
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env') })

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

async function authenticate(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.error('❌ 請設置 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變量')
    process.exit(1)
  }

  console.log('🔐 正在登入管理員帳號...')
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
  console.log('✅ 登入成功')
}

// 失敗的項目數據
const failedItems = [
  {
    id: "emo-010",
    category: "emotional",
    name: "24小時情緒支援熱線",
    provider: "紅十字會 / 社會福利署",
    description: "24小時情緒支援熱線",
    contact: "2343 2255 (社署) / 18288 (明愛)",
    location: "電話熱線",
    source_ref: "PDF P.723"
  },
  {
    id: "emo-007",
    category: "emotional",
    name: "火災事件情緒支援熱線",
    provider: "鄰舍輔導會賽馬會大埔北青少年綜合服務中心",
    description: "24小時支援熱線",
    contact: "2651 1998 / 5720 2246 (麥先生)",
    location: "大埔富亨鄰里社區中心一樓",
    source_ref: "PDF P.36"
  },
  {
    id: "med-002",
    category: "medical",
    name: "醫療站 / 藥劑師諮詢",
    provider: "醫務衛生局 / 聖雅各福群會",
    description: "臨時庇護中心醫療站 (08:00-20:00); 藥劑師諮詢 (2116 8836)",
    contact: "見描述",
    location: "各臨時庇護中心",
    source_ref: "PDF P.42"
  },
  {
    id: "acc-004",
    category: "accommodation",
    name: "過渡性房屋 (七星薈/雙魚薈)",
    provider: "路德會",
    description: "提供緊急支援單位",
    contact: "9644 4038 / 9299 9412",
    location: "元朗錦泰路 / 粉錦公路",
    source_ref: "PDF P.41"
  }
]

async function fixFailedItems() {
  await authenticate()

  console.log('\n🔧 開始修復失敗的支援服務項目...')
  console.log(`   總共 ${failedItems.length} 項\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < failedItems.length; i++) {
    const item = failedItems[i]
    
    try {
      // 檢查是否已存在
      const existingQuery = query(
        collection(db, 'reliefServices'),
        where('id', '==', item.id)
      )
      const existing = await getDocs(existingQuery)
      
      if (existing.size > 0) {
        console.log(`⏭️  [${i + 1}/${failedItems.length}] 已存在，跳過: ${item.name} (${item.id})`)
        skipCount++
        continue
      }

      // 轉換為 Firestore 格式
      const firestoreData = {
        id: item.id,
        category: item.category,
        name: item.name,
        provider: item.provider,
        description: item.description,
        contact: item.contact,
        location: item.location,
        openingHours: null,
        note: null,
        source_ref: item.source_ref || null,
        status: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      // 等待一小段時間，避免速率限制
      await new Promise(resolve => setTimeout(resolve, 500))

      await addDoc(collection(db, 'reliefServices'), firestoreData)
      console.log(`✅ [${i + 1}/${failedItems.length}] 已添加: ${item.name} (${item.category})`)
      successCount++
    } catch (error: any) {
      console.error(`❌ [${i + 1}/${failedItems.length}] 添加失敗: ${item.name}`, error.message)
      errorCount++
    }
  }

  console.log('\n📊 修復完成統計:')
  console.log(`   ✅ 成功: ${successCount}`)
  console.log(`   ⏭️  跳過: ${skipCount}`)
  console.log(`   ❌ 失敗: ${errorCount}`)
  console.log(`   📦 總計: ${failedItems.length}\n`)

  process.exit(0)
}

fixFailedItems().catch((error) => {
  console.error('❌ 修復失敗:', error)
  process.exit(1)
})

