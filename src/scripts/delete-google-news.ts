/**
 * 刪除所有來自 Google News 的新聞
 * 使用方式：npm run delete:google-news
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore'
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

/**
 * 認證用戶
 */
async function authenticate(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      '請提供管理員帳號和密碼：\n  npm run delete:google-news <email> <password>\n  或在 .env 文件中設置 ADMIN_EMAIL 和 ADMIN_PASSWORD'
    )
  }

  try {
    await signInWithEmailAndPassword(auth, email, password)
    console.log(`✅ 已登入: ${email}`)
  } catch (error: any) {
    throw new Error(`登入失敗: ${error.message}`)
  }
}

/**
 * 刪除所有 Google News 來源的新聞
 */
async function deleteGoogleNews() {
  try {
    console.log('\n🔍 正在查找所有 Google News 來源的新聞...\n')

    // 查詢所有 source 為 "Google News" 的新聞
    const newsCollection = collection(db, 'news')
    const q = query(newsCollection, where('source', '==', 'Google News'))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.log('ℹ️  沒有找到 Google News 來源的新聞')
      return
    }

    console.log(`📊 找到 ${snapshot.size} 條 Google News 來源的新聞\n`)

    // 顯示將要刪除的新聞
    console.log('將要刪除的新聞：')
    snapshot.docs.forEach((docSnapshot, index) => {
      const data = docSnapshot.data()
      console.log(`  ${index + 1}. ${data.title || '無標題'} (ID: ${docSnapshot.id})`)
    })

    console.log('\n⚠️  確認刪除？')
    console.log('   這將永久刪除上述所有新聞，無法恢復！')
    console.log('   按 Ctrl+C 取消，或等待 5 秒後自動開始刪除...\n')

    // 等待 5 秒讓用戶有機會取消
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log('🗑️  開始刪除...\n')

    let deletedCount = 0
    let errorCount = 0

    // 批量刪除
    for (const docSnapshot of snapshot.docs) {
      try {
        const data = docSnapshot.data()
        const title = data.title || '無標題'
        
        await deleteDoc(doc(db, 'news', docSnapshot.id))
        console.log(`✅ 已刪除: ${title}`)
        deletedCount++

        // 添加小延遲避免請求過快
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error: any) {
        console.error(`❌ 刪除失敗 (ID: ${docSnapshot.id}): ${error.message}`)
        errorCount++
      }
    }

    console.log(`\n✅ 完成！`)
    console.log(`   成功刪除: ${deletedCount} 條新聞`)
    if (errorCount > 0) {
      console.log(`   刪除失敗: ${errorCount} 條新聞`)
    }
  } catch (error: any) {
    console.error('❌ 刪除失敗:', error.message)
    if (error.code === 'permission-denied') {
      console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則，並管理員帳號有刪除權限')
    }
    throw error
  }
}

/**
 * 主函數
 */
async function main() {
  try {
    await authenticate()
    await deleteGoogleNews()
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ 執行失敗:', error.message)
    process.exit(1)
  }
}

main()

