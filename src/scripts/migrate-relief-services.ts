/**
 * 將 fullReliefData.ts 中的數據遷移到 Firestore reliefServices 集合
 * 使用方式：npm run migrate:relief-services
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
import { resolve } from 'path'
import { fullReliefData } from '../data/fullReliefData'

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

async function migrateReliefServices() {
  await authenticate()

  console.log('\n📦 開始遷移支援服務數據...')
  console.log(`   總共 ${fullReliefData.length} 項服務\n`)

  // 檢查是否已有數據
  const existingDocs = await getDocs(collection(db, 'reliefServices'))
  if (existingDocs.size > 0) {
    console.log(`⚠️  發現 ${existingDocs.size} 項現有數據`)
    console.log('   是否要繼續？這可能會創建重複數據')
    console.log('   如需清空現有數據，請先手動刪除 Firestore 中的 reliefServices 集合\n')
  }

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < fullReliefData.length; i++) {
    const item = fullReliefData[i]
    
    try {
      // 檢查是否已存在（根據 id）
      const existingQuery = query(
        collection(db, 'reliefServices'),
        where('id', '==', item.id)
      )
      const existing = await getDocs(existingQuery)
      
      if (existing.size > 0) {
        console.log(`⏭️  [${i + 1}/${fullReliefData.length}] 跳過已存在的服務: ${item.name} (${item.id})`)
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
        openingHours: item.openingHours || null,
        note: item.note || null,
        source_ref: item.source_ref || null,
        status: item.status || null,
        order: i + 1, // 使用原始順序
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      await addDoc(collection(db, 'reliefServices'), firestoreData)
      console.log(`✅ [${i + 1}/${fullReliefData.length}] 已添加: ${item.name} (${item.category})`)
      successCount++
    } catch (error: any) {
      console.error(`❌ [${i + 1}/${fullReliefData.length}] 添加失敗: ${item.name}`, error.message)
      errorCount++
    }
  }

  console.log('\n📊 遷移完成統計:')
  console.log(`   ✅ 成功: ${successCount}`)
  console.log(`   ⏭️  跳過: ${skipCount}`)
  console.log(`   ❌ 失敗: ${errorCount}`)
  console.log(`   📦 總計: ${fullReliefData.length}\n`)

  process.exit(0)
}

migrateReliefServices().catch((error) => {
  console.error('❌ 遷移失敗:', error)
  process.exit(1)
})

