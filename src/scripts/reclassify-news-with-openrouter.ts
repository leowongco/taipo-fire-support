/**
 * 使用 OpenRouter Worker 重新分類 Firestore 中的新聞
 * 使用方式：npm run reclassify:news-openrouter
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import * as dotenv from 'dotenv'
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

// OpenRouter Worker URL（從環境變量讀取）
let OPENROUTER_WORKER_URL = process.env.OPENROUTER_WORKER_URL || process.env.VITE_OPENROUTER_WORKER_URL

if (!OPENROUTER_WORKER_URL) {
  console.error('❌ 請設置 OPENROUTER_WORKER_URL 環境變量')
  console.error('')
  console.error('方法 1: 在 .env 文件中添加：')
  console.error('  OPENROUTER_WORKER_URL=https://news-classifier.lwp.workers.dev')
  console.error('')
  console.error('方法 2: 獲取實際的 Worker URL：')
  console.error('  1. 前往 Cloudflare Dashboard: https://dash.cloudflare.com')
  console.error('  2. 選擇 Workers & Pages')
  console.error('  3. 找到 "news-classifier" Worker')
  console.error('  4. 複製 Worker URL（格式：https://news-classifier.<your-subdomain>.workers.dev）')
  console.error('')
  console.error('如果 Worker 尚未部署，請先執行：')
  console.error('  cd workers/news-classifier')
  console.error('  npm install')
  console.error('  npx wrangler secret put OPENROUTER_API_KEY  # 設置 OpenRouter API Key')
  console.error('  npx wrangler deploy')
  process.exit(1)
}

// 確保 URL 有正確的前綴
if (!OPENROUTER_WORKER_URL.startsWith('http://') && !OPENROUTER_WORKER_URL.startsWith('https://')) {
  OPENROUTER_WORKER_URL = `https://${OPENROUTER_WORKER_URL}`
  console.log(`⚠️  URL 缺少協議前綴，已自動添加: ${OPENROUTER_WORKER_URL}`)
}

// 驗證 URL 格式
try {
  new URL(OPENROUTER_WORKER_URL)
} catch (error) {
  console.error(`❌ 無效的 URL 格式: ${OPENROUTER_WORKER_URL}`)
  console.error('請確保 URL 格式正確，例如：https://news-classifier.lwp.workers.dev')
  process.exit(1)
}

// 此時 OPENROUTER_WORKER_URL 已經確定不是 undefined 且格式正確
const WORKER_URL: string = OPENROUTER_WORKER_URL

console.log(`🔗 OpenRouter Worker URL: ${WORKER_URL}\n`)

// 新聞分類類型
type NewsCategory =
  | "event-update"
  | "financial-support"
  | "emotional-support"
  | "accommodation"
  | "medical-legal"
  | "reconstruction"
  | "statistics"
  | "community-support"
  | "government-announcement"
  | "general-news"

/**
 * 檢查新聞是否與大埔火災相關
 * 使用關鍵詞匹配來判斷新聞是否與大埔宏福苑火災事件相關
 * 必須同時包含火災相關關鍵詞和地點關鍵詞，以避免誤判其他地區的火災
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns true 如果與大埔火災相關，false 如果無關
 */
function checkFireRelated(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase()
  
  // 火災相關關鍵詞（不包括單獨的"火"字，太寬泛）
  const fireKeywords = [
    '火災', '火警', '大火', '火勢', '起火', '燃燒', '火場',
    '五級火', '四級火', '三級火', '二級火', '一級火',
    '撲救', '滅火', '消防員', '消防處', '消防局', '消防隊',
    '傷亡', '罹難', '遇難', '失蹤', '受傷', '死亡', '殉職',
    '庇護中心', '臨時住宿', '疏散', '撤離', '過渡性房屋',
    '重建', '善後', '支援', '援助', '物資', '捐款', '應急',
    '調查', '原因', '責任', '承建商', '維修工程', '棚網', '外牆',
    '默哀', '弔唁', '哀悼', '悼念', '下半旗'
  ]
  
  // 地點關鍵詞（必須包含其中一個）
  const locationKeywords = [
    '大埔', '宏福苑', '宏仁閣', '宏道閣', '宏福'
  ]
  
  // 檢查是否包含地點關鍵詞
  const hasLocation = locationKeywords.some(keyword => text.includes(keyword))
  
  // 如果包含地點關鍵詞，檢查是否也包含火災相關關鍵詞
  if (hasLocation) {
    // 如果包含"宏福苑"、"宏仁閣"、"宏道閣"等特定地點，直接認為相關（因為這些地點本身就與火災事件相關）
    if (text.includes('宏福苑') || text.includes('宏仁閣') || text.includes('宏道閣')) {
      return true
    }
    // 如果包含"大埔"或"宏福"，必須同時包含火災相關關鍵詞
    return fireKeywords.some(keyword => text.includes(keyword))
  }
  
  // 如果沒有地點關鍵詞，不認為相關（避免誤判其他地區的火災）
  return false
}

/**
 * 使用 OpenRouter Worker 進行新聞分類
 * @param title 新聞標題
 * @param content 新聞內容
 * @returns 分類結果
 */
async function classifyWithOpenRouter(
  title: string,
  content: string,
  workerUrl: string
): Promise<{ category: NewsCategory; details: string } | null> {
  try {
    // 驗證 URL 格式
    let url: URL
    try {
      url = new URL(workerUrl)
    } catch (urlError) {
      throw new Error(`無效的 URL 格式: ${workerUrl}。請確保 URL 包含 https:// 前綴`)
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter Worker API 錯誤 (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`OpenRouter Worker 返回錯誤: ${data.error}`)
    }

    if (!data.category) {
      throw new Error('OpenRouter Worker 返回的數據缺少 category 字段')
    }

    return {
      category: data.category as NewsCategory,
      details: data.details || '',
    }
  } catch (error: any) {
    // 提供更詳細的錯誤訊息
    if (error.message.includes('Failed to parse URL') || error.message.includes('無效的 URL')) {
      console.error(`  ❌ URL 格式錯誤: ${error.message}`)
      console.error(`  💡 提示: 請確保 .env 文件中的 OPENROUTER_WORKER_URL 包含完整的 URL，例如：https://news-classifier.lwp.workers.dev`)
    } else if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error(`  ❌ 無法連接到 Worker: ${error.message}`)
      console.error(`  💡 提示: 請檢查 Worker URL 是否正確，以及 Worker 是否已部署`)
    } else {
      console.error(`  ❌ 分類失敗: ${error.message}`)
    }
    return null
  }
}

/**
 * 重新分類所有新聞
 */
async function reclassifyAllNews() {
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

    // 獲取所有新聞（按時間倒序）
    const newsQuery = query(
      collection(db, 'news'),
      orderBy('timestamp', 'desc')
    )

    const newsSnapshot = await getDocs(newsQuery)

    if (newsSnapshot.empty) {
      console.log('⚠️  沒有找到新聞')
      process.exit(0)
    }

    console.log(`📰 找到 ${newsSnapshot.size} 條新聞，開始重新分類...\n`)

    let successCount = 0
    let skippedCount = 0
    let errorCount = 0
    let unchangedCount = 0
    let deletedCount = 0

    // 處理每條新聞
    for (let i = 0; i < newsSnapshot.docs.length; i++) {
      const docSnapshot = newsSnapshot.docs[i]
      const data = docSnapshot.data()
      const newsId = docSnapshot.id
      const title = data.title || ''
      const content = data.content || data.description || ''
      const currentCategory = data.category || 'general-news'

      if (!title) {
        console.log(`\n[${i + 1}/${newsSnapshot.size}] ⏭️  跳過 ${newsId}: 沒有標題`)
        skippedCount++
        continue
      }

      if (!content || content.length < 50) {
        console.log(`\n[${i + 1}/${newsSnapshot.size}] ⏭️  跳過 ${newsId}: 內容太短或缺失`)
        console.log(`   標題: ${title.substring(0, 60)}...`)
        skippedCount++
        continue
      }

      console.log(`\n[${i + 1}/${newsSnapshot.size}] 📄 處理: ${title.substring(0, 60)}...`)
      console.log(`   當前分類: ${currentCategory}`)
      console.log(`   內容長度: ${content.length} 字元`)

      // 1. 先檢查是否與火災相關
      console.log(`   🔍 正在檢查是否與火災相關...`)
      const isFireRelated = checkFireRelated(title, content)
      
      if (!isFireRelated) {
        // 如果與火災無關，刪除該新聞
        console.log(`   ❌ 新聞與火災無關，將刪除`)
        try {
          const newsRef = doc(db, 'news', newsId)
          await deleteDoc(newsRef)
          console.log(`   🗑️  已刪除新聞: ${title.substring(0, 60)}...`)
          deletedCount++
        } catch (deleteError: any) {
          console.error(`   ❌ 刪除失敗: ${deleteError.message}`)
          errorCount++
        }
        // 添加延遲避免請求過快
        if (i < newsSnapshot.docs.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        continue
      }
      
      console.log(`   ✅ 確認與火災相關`)

      // 2. 使用 OpenRouter Worker 進行分類
      console.log(`   🤖 正在使用 OpenRouter AI 分類...`)
      const classification = await classifyWithOpenRouter(title, content, WORKER_URL)

      if (!classification) {
        console.log(`   ❌ 分類失敗，跳過`)
        errorCount++
        continue
      }

      const newCategory = classification.category
      console.log(`   ✅ AI 分類結果: ${newCategory}`)
      console.log(`   📊 辯論過程: ${classification.details}`)

      // 如果分類相同，跳過更新
      if (newCategory === currentCategory) {
        console.log(`   ⏭️  分類未改變，跳過更新`)
        unchangedCount++
        continue
      }

      // 更新 Firestore
      try {
        const newsRef = doc(db, 'news', newsId)
        await updateDoc(newsRef, {
          category: newCategory,
          // 可選：記錄重新分類的時間和來源
          reclassifiedAt: new Date().toISOString(),
          reclassifiedBy: 'openrouter-worker',
        })

        console.log(`   ✅ 已更新分類: ${currentCategory} → ${newCategory}`)
        successCount++
      } catch (updateError: any) {
        console.error(`   ❌ 更新 Firestore 失敗: ${updateError.message}`)
        errorCount++
      }

      // 添加延遲避免請求過快（每條記錄之間延遲 1 秒）
      if (i < newsSnapshot.docs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // 顯示統計
    console.log('\n' + '='.repeat(50))
    console.log('📊 重新分類完成統計：')
    console.log(`  ✅ 成功更新: ${successCount} 條`)
    console.log(`  ⏭️  跳過（無變化）: ${unchangedCount} 條`)
    console.log(`  ⏭️  跳過（數據不完整）: ${skippedCount} 條`)
    console.log(`  🗑️  已刪除（與火災無關）: ${deletedCount} 條`)
    console.log(`  ❌ 失敗: ${errorCount} 條`)
    console.log(`  📋 總計: ${newsSnapshot.size} 條`)
    console.log('='.repeat(50))

    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ 執行失敗:', error.message)
    process.exit(1)
  }
}

// 執行重新分類
if (require.main === module) {
  reclassifyAllNews()
}

export { reclassifyAllNews }

