/**
 * 遷移公告到新聞集合
 * 將 announcements 集合中的數據遷移到 news 集合，並使用 AI 進行分類
 * 使用方式：npm run migrate:announcements-to-news
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore'
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

// AI 分類結果接口
interface ClassificationResult {
  category: NewsCategory
  confidence: number
  source: "huggingface" | "groq" | "fallback"
}

/**
 * 使用 Groq AI 進行新聞分類
 */
async function classifyWithGroq(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.warn("  ⚠️ Groq API Key 未設置，跳過 Groq 分類")
      return null
    }

    const text = `${title}\n\n${content}`.substring(0, 2000)
    
    // 構建分類標籤列表（與 Hugging Face 使用相同的標籤）
    const labels = [
      "event-update",
      "financial-support",
      "emotional-support",
      "accommodation",
      "medical-legal",
      "reconstruction",
      "statistics",
      "community-support",
      "government-announcement",
      "general-news",
    ]
    const labelsList = labels.join("、")

    const prompt = `你是一個嚴謹的新聞分類員。請閱讀以下內容，並將其分類為以下其中一類：

${labelsList}

新聞標題：${title}

新聞內容：${text}

規則：
1. 只回答分類名稱（例如：event-update），不要有任何解釋。
2. 必須從上述列表中選擇。`

    // 嘗試多個可用的模型（按優先級，優先使用最便宜的生產模型）
    // 價格參考：llama-3.1-8b-instant ($0.05/$0.08) < gpt-oss-20b ($0.075/$0.30) < llama-3.3-70b ($0.59/$0.79)
    const models = [
      "llama-3.1-8b-instant", // 最便宜：$0.05/$0.08 per 1M tokens，速度 560 t/s
      "openai/gpt-oss-20b", // 第二便宜：$0.075/$0.30 per 1M tokens，速度 1000 t/s
      "llama-3.3-70b-versatile", // 更強大但更貴：$0.59/$0.79 per 1M tokens，速度 280 t/s
      "openai/gpt-oss-120b", // 最強大但最貴：$0.15/$0.60 per 1M tokens，速度 500 t/s
    ]

    let lastError: Error | null = null

    for (const model of models) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: "你是一個專業的新聞分類助手，請準確地將新聞分類到指定的類別。",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.3,
            max_tokens: 50,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          // 如果是模型停用錯誤，嘗試下一個模型
          if (errorData.error?.code === "model_decommissioned" || response.status === 400) {
            console.warn(`  ⚠️ 模型 ${model} 不可用，嘗試下一個模型...`)
            lastError = new Error(`模型 ${model} 已停用`)
            continue
          }
          const errorText = await response.text()
          throw new Error(`Groq API error: ${response.status} ${errorText}`)
        }

        const result = await response.json()
        const categoryText = result.choices?.[0]?.message?.content?.trim().toLowerCase()

        if (!categoryText) {
          throw new Error("Groq API 返回空結果")
        }

        const category = labels.find(
          (label) => label.toLowerCase() === categoryText || categoryText.includes(label.toLowerCase())
        ) as NewsCategory | undefined

        if (!category) {
          console.warn(`  ⚠️ Groq 返回無效分類: ${categoryText}`)
          return null
        }

        const confidence = categoryText === category.toLowerCase() ? 0.85 : 0.70

        console.log(`  ✓ Groq AI 分類 (模型: ${model}): ${category} (估算信心度: ${(confidence * 100).toFixed(1)}%)`)

        return {
          category,
          confidence,
          source: "groq",
        }
      } catch (error: any) {
        lastError = error
        // 如果不是最後一個模型，繼續嘗試
        if (model !== models[models.length - 1]) {
          continue
        }
        // 最後一個模型也失敗了
        throw error
      }
    }

    // 所有模型都失敗了
    if (lastError) {
      throw lastError
    }
    
    // 不應該到達這裡，但為了類型安全
    return null
  } catch (error: any) {
    console.warn(`  ⚠️ Groq AI 分類失敗: ${error.message}`)
    return null
  }
}

/**
 * 使用 Hugging Face Zero-Shot 模型進行新聞分類（選手 A）
 * 如果失敗就快速放棄，主要依賴 Groq
 */
async function classifyWithHuggingFace(
  title: string,
  content: string
): Promise<ClassificationResult | null> {
  // 只嘗試一次，如果失敗就放棄（避免浪費時間）
  const model = "facebook/bart-large-mnli"
  const text = `${title}\n\n${content}`.substring(0, 1000)
  const labels = [
    "event-update",
    "financial-support",
    "emotional-support",
    "accommodation",
    "medical-legal",
    "reconstruction",
    "statistics",
    "community-support",
    "government-announcement",
    "general-news",
  ]
  const endpoint = `https://api-inference.huggingface.co/models/${model}`

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          candidate_labels: labels,
          multi_label: false,
        },
      }),
    })

    // 如果模型不可用（410/404），直接放棄
    if (response.status === 410 || response.status === 404) {
      // 靜默失敗，不輸出日誌（因為主要依賴 Groq）
      return null
    }

    // 處理 503 錯誤（模型正在加載）- 只等待一次，最多 10 秒
    if (response.status === 503) {
      const errorData = await response.json().catch(() => ({}))
      const estimatedTime = Math.min(errorData.estimated_time || 10, 10)
      // 如果等待時間太長，直接放棄
      if (estimatedTime > 10) {
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, estimatedTime * 1000))
      
      // 重試一次
      const retryResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: labels,
            multi_label: false,
          },
        }),
      })
      
      if (!retryResponse.ok || retryResponse.status === 410 || retryResponse.status === 404) {
        return null
      }
      
      const result = await retryResponse.json()
      if (result.labels && result.scores) {
        const maxIndex = result.scores.indexOf(Math.max(...result.scores))
        const category = result.labels[maxIndex] as NewsCategory
        const confidence = result.scores[maxIndex]
        console.log(
          `  ✓ Hugging Face 分類: ${category} (信心度: ${(confidence * 100).toFixed(1)}%)`
        )
        return {
          category,
          confidence,
          source: "huggingface",
        }
      }
      return null
    }

    if (!response.ok) {
      return null
    }

    const result = await response.json()

    // 處理錯誤響應
    if (result.error) {
      return null
    }

    // 解析結果
    if (result.labels && result.scores) {
      const maxIndex = result.scores.indexOf(Math.max(...result.scores))
      const category = result.labels[maxIndex] as NewsCategory
      const confidence = result.scores[maxIndex]
      console.log(
        `  ✓ Hugging Face 分類: ${category} (信心度: ${(confidence * 100).toFixed(1)}%)`
      )
      return {
        category,
        confidence,
        source: "huggingface",
      }
    }

    return null
  } catch (error: any) {
    // 任何錯誤都直接放棄，不重試
    return null
  }
}

/**
 * 備用分類方法（當 AI 分類失敗時使用）
 * 使用關鍵詞匹配，按優先級順序檢查
 */
function classifyNewsFallback(
  title: string,
  content: string
): NewsCategory {
  const text = `${title} ${content}`.toLowerCase()

  // 優先級 1: 統計數據（死亡、受傷、失蹤等）
  if (
    text.includes("死亡") ||
    text.includes("罹難") ||
    text.includes("遇難") ||
    text.includes("受傷") ||
    text.includes("失蹤") ||
    text.includes("失聯") ||
    text.includes("統計") ||
    text.includes("人數") ||
    text.includes("個案")
  ) {
    return "statistics"
  }

  // 優先級 2: 事件更新（火災、救援、現場等）
  if (
    text.includes("火") ||
    text.includes("火警") ||
    text.includes("火災") ||
    text.includes("火勢") ||
    text.includes("救援") ||
    text.includes("現場") ||
    text.includes("進展") ||
    text.includes("控制") ||
    text.includes("撲救") ||
    text.includes("停工") ||
    text.includes("工程") ||
    text.includes("五級")
  ) {
    return "event-update"
  }

  // 優先級 3: 重建資訊
  if (
    text.includes("重建") ||
    text.includes("恢復") ||
    text.includes("修復") ||
    text.includes("時間表") ||
    text.includes("復原") ||
    text.includes("修繕")
  ) {
    return "reconstruction"
  }

  // 優先級 4: 經濟支援
  if (
    text.includes("資助") ||
    text.includes("補助") ||
    text.includes("津貼") ||
    text.includes("賠償") ||
    text.includes("基金") ||
    text.includes("捐款") ||
    text.includes("財政") ||
    text.includes("經濟") ||
    text.includes("現金") ||
    text.includes("援助") ||
    text.includes("支援") && (text.includes("經濟") || text.includes("財政") || text.includes("金錢"))
  ) {
    return "financial-support"
  }

  // 優先級 5: 住宿支援
  if (
    text.includes("庇護") ||
    text.includes("住宿") ||
    text.includes("臨時") ||
    text.includes("過渡性房屋") ||
    text.includes("休息站") ||
    text.includes("社區會堂") ||
    text.includes("臨時居所") ||
    text.includes("安置")
  ) {
    return "accommodation"
  }

  // 優先級 6: 情緒支援
  if (
    text.includes("心理") ||
    text.includes("輔導") ||
    text.includes("情緒") ||
    text.includes("社工") ||
    text.includes("精神健康") ||
    text.includes("創傷") ||
    text.includes("哀傷") ||
    text.includes("哀悼") ||
    text.includes("心理治療")
  ) {
    return "emotional-support"
  }

  // 優先級 7: 醫療/法律
  if (
    text.includes("醫療") ||
    text.includes("法律") ||
    text.includes("諮詢") ||
    text.includes("義診") ||
    text.includes("醫療站") ||
    text.includes("律師") ||
    text.includes("法律顧問")
  ) {
    return "medical-legal"
  }

  // 優先級 8: 社區支援
  if (
    text.includes("義工") ||
    text.includes("物資") ||
    text.includes("社區") ||
    text.includes("志願") ||
    text.includes("民間") ||
    text.includes("非政府")
  ) {
    return "community-support"
  }

  // 優先級 9: 政府公告
  if (
    text.includes("政府") ||
    text.includes("民政") ||
    text.includes("社會福利署") ||
    text.includes("消防處") ||
    text.includes("官方") ||
    text.includes("政務司") ||
    text.includes("局長") ||
    text.includes("署長") ||
    text.includes("會見傳媒") ||
    text.includes("答問")
  ) {
    return "government-announcement"
  }

  // 默認：一般新聞
  return "general-news"
}

/**
 * 使用 Groq 作為裁判進行最終裁決（當兩個 AI 意見分歧時）
 */
async function judgeWithGroq(
  title: string,
  content: string,
  hfResult: ClassificationResult,
  groqResult: ClassificationResult
): Promise<NewsCategory> {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.warn(`  ⚠️ Groq API Key 未設置，無法進行裁判，使用 Hugging Face 結果`)
      return hfResult.category
    }

    const text = `${title}\n\n${content}`.substring(0, 2000)
    const labels = [
      "event-update",
      "financial-support",
      "emotional-support",
      "accommodation",
      "medical-legal",
      "reconstruction",
      "statistics",
      "community-support",
      "government-announcement",
      "general-news",
    ]
    const labelsList = labels.join("、")

    const judgePrompt = `你是資深新聞編輯。對於以下這則新聞，你的兩個助手有不同意見。請做出最終裁決。

新聞標題：${title}

新聞內容：${text}

助手 A (AI模型) 認為是：${hfResult.category} (信心度: ${(hfResult.confidence * 100).toFixed(1)}%)
助手 B (語言專家) 認為是：${groqResult.category} (信心度: ${(groqResult.confidence * 100).toFixed(1)}%)

可選分類：${labelsList}

請考慮哪個分類更準確。如果內容包含具體的物資請求(如水、口罩)，傾向選「financial-support」。
如果包含封路或巴士改道，選「event-update」。
如果包含死傷人數統計，選「statistics」。
如果包含政府部門的正式公告，選「government-announcement」。

只需回答最終分類名稱（例如：event-update），不要解釋。`

    // 使用更強大的模型作為裁判（優先使用便宜的模型）
    const judgeModels = [
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
    ]

    for (const model of judgeModels) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: "你是一個專業的新聞分類裁判，請根據兩個助手的意見做出最終裁決。",
              },
              {
                role: "user",
                content: judgePrompt,
              },
            ],
            temperature: 0.1, // 低溫度確保穩定
            max_tokens: 50,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          if (errorData.error?.code === "model_decommissioned" || response.status === 400) {
            if (model !== judgeModels[judgeModels.length - 1]) {
              continue // 嘗試下一個模型
            }
          }
          throw new Error(`Groq API error: ${response.status}`)
        }

        const result = await response.json()
        const verdictText = result.choices?.[0]?.message?.content?.trim().toLowerCase()

        if (!verdictText) {
          throw new Error("Groq 裁判返回空結果")
        }

        // 驗證返回的分類是否有效
        const verdict = labels.find(
          (label) => label.toLowerCase() === verdictText || verdictText.includes(label.toLowerCase())
        ) as NewsCategory | undefined

        if (verdict) {
          console.log(`  ⚖️ 最終裁決 (模型: ${model}): ${verdict}`)
          return verdict
        } else {
          console.warn(`  ⚠️ Groq 裁判返回無效分類: ${verdictText}，使用 Hugging Face 結果`)
          return hfResult.category
        }
      } catch (error: any) {
        if (model !== judgeModels[judgeModels.length - 1]) {
          continue // 嘗試下一個模型
        }
        throw error
      }
    }

    // 所有模型都失敗，使用 Hugging Face 結果
    console.warn(`  ⚠️ 裁判模式失敗，使用 Hugging Face 結果`)
    return hfResult.category
  } catch (error: any) {
    console.error(`  ⚠️ 裁判模式失敗: ${error.message}，使用 Hugging Face 結果`)
    return hfResult.category
  }
}

/**
 * 使用 Hugging Face 和 Groq AI 進行辯論比對分類
 */
async function classifyNewsWithAI(
  title: string,
  content: string
): Promise<NewsCategory> {
  try {
    console.log(`  🤖 正在使用 AI 分類（主要使用 Groq，Hugging Face 作為可選驗證）...`)

    // 同時調用兩個 AI 服務
    const [huggingFaceResult, groqResult] = await Promise.allSettled([
      classifyWithHuggingFace(title, content),
      classifyWithGroq(title, content),
    ])

    const hfResult =
      huggingFaceResult.status === "fulfilled" ? huggingFaceResult.value : null
    const groqResultValue = groqResult.status === "fulfilled" ? groqResult.value : null

    // 如果兩個服務都失敗，使用備用分類
    if (!hfResult && !groqResultValue) {
      console.warn(`  ⚠️ 所有 AI 服務都失敗，使用備用分類`)
      return classifyNewsFallback(title, content)
    }

    // 如果只有一個服務成功，使用該結果
    if (!hfResult && groqResultValue) {
      console.log(`  ℹ️ 僅 Groq AI 成功，使用 Groq 結果`)
      return groqResultValue.category
    }

    if (hfResult && !groqResultValue) {
      console.log(`  ℹ️ 僅 Hugging Face 成功，使用 Hugging Face 結果`)
      return hfResult.category
    }

    // 兩個服務都成功，進行辯論比對
    if (hfResult && groqResultValue) {
      console.log(`  🔹 選手 A (Hugging Face) 建議: ${hfResult.category} (信心度: ${(hfResult.confidence * 100).toFixed(1)}%)`)
      console.log(`  🔸 選手 B (Groq) 建議: ${groqResultValue.category} (信心度: ${(groqResultValue.confidence * 100).toFixed(1)}%)`)

      // 情況一：雙方達成共識
      if (hfResult.category === groqResultValue.category) {
        console.log(`  ✅ 雙方達成共識！使用該分類`)
        return hfResult.category
      }

      // 情況二：意見分歧，啟動裁判模式
      console.warn(`  ⚠️ 意見分歧！啟動裁判模式...`)

      // 如果 HF 信心極高 (>0.95)，傾向相信 HF（因為它是專門做分類的）
      if (hfResult.confidence > 0.95) {
        console.log(
          `  ⚖️ 裁判判定: Hugging Face 信心極高 (${(hfResult.confidence * 100).toFixed(1)}%)，採納其意見。`
        )
        return hfResult.category
      }

      // 否則，讓 Groq 擔任裁判，參考 HF 的意見進行最終裁決
      return await judgeWithGroq(title, content, hfResult, groqResultValue)
    }

    // 不應該到達這裡，但為了類型安全
    return classifyNewsFallback(title, content)
  } catch (error: any) {
    console.warn(`  ⚠️ AI 分類失敗: ${error.message}，使用備用分類`)
    return classifyNewsFallback(title, content)
  }
}

/**
 * 認證用戶
 */
async function authenticate(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || process.argv[2]
  const password = process.env.ADMIN_PASSWORD || process.argv[3]

  if (!email || !password) {
    throw new Error(
      '請提供管理員帳號和密碼：\n  npm run migrate:announcements-to-news <email> <password>\n  或在 .env 文件中設置 ADMIN_EMAIL 和 ADMIN_PASSWORD'
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
 * 檢查新聞是否已存在
 */
async function newsExists(title: string, url?: string): Promise<boolean> {
  try {
    // 獲取所有新聞（用於檢查重複）
    const newsRef = collection(db, 'news')
    const newsSnapshot = await getDocs(newsRef)
    
    // 檢查標題
    const titleMatch = newsSnapshot.docs.find(
      (doc) => doc.data().title === title
    )
    if (titleMatch) return true

    // 如果有 URL，檢查 URL
    if (url) {
      const urlMatch = newsSnapshot.docs.find(
        (doc) => doc.data().url === url
      )
      if (urlMatch) return true
    }

    return false
  } catch (error) {
    console.error('檢查新聞是否存在時發生錯誤:', error)
    return false
  }
}

/**
 * 遷移公告到新聞
 */
async function migrateAnnouncementsToNews(deleteAfterMigration: boolean = false): Promise<void> {
  try {
    console.log('\n📰 開始遷移公告到新聞集合...\n')

    // 獲取所有公告
    const announcementsRef = collection(db, 'announcements')
    const announcementsQuery = query(announcementsRef, orderBy('timestamp', 'desc'))
    const announcementsSnapshot = await getDocs(announcementsQuery)

    if (announcementsSnapshot.empty) {
      console.log('ℹ️  沒有找到任何公告')
      return
    }

    console.log(`📋 找到 ${announcementsSnapshot.docs.length} 條公告\n`)

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0

    // 遍歷每條公告
    for (const announcementDoc of announcementsSnapshot.docs) {
      const announcement = announcementDoc.data()
      const announcementId = announcementDoc.id

      try {
        console.log(`\n處理公告: ${announcement.title}`)

        // 檢查是否已存在
        const exists = await newsExists(announcement.title, announcement.url)
        if (exists) {
          console.log(`  ⏭️  已存在，跳過`)
          skippedCount++
          if (deleteAfterMigration) {
            await deleteDoc(doc(db, 'announcements', announcementId))
            console.log(`  🗑️  已刪除原公告`)
          }
          continue
        }

        // 使用 AI 進行分類
        console.log(`  🤖 正在使用 AI 分類...`)
        const newsCategory = await classifyNewsWithAI(
          announcement.title,
          announcement.content || ''
        )

        // 根據來源設置標籤
        let tag: 'gov' | 'news' = 'news'
        if (
          announcement.source?.includes('政府') ||
          announcement.source?.includes('Gov') ||
          announcement.source?.includes('官方')
        ) {
          tag = 'gov'
        }

        // 創建新聞文檔
        const newsData = {
          title: announcement.title,
          content: announcement.content || '',
          source: announcement.source || '未知來源',
          url: announcement.url || undefined,
          tag,
          newsCategory,
          timestamp: announcement.timestamp || Timestamp.now(),
        }

        // 添加到 news 集合
        await addDoc(collection(db, 'news'), newsData)
        console.log(`  ✅ 已遷移到新聞集合 (分類: ${newsCategory})`)

        migratedCount++

        // 如果設置了刪除選項，刪除原公告
        if (deleteAfterMigration) {
          await deleteDoc(doc(db, 'announcements', announcementId))
          console.log(`  🗑️  已刪除原公告`)
        }

        // 添加延遲避免請求過快（AI API 調用後需要更多時間）
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error: any) {
        console.error(`  ❌ 處理失敗: ${error.message}`)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 遷移完成統計：')
    console.log(`  ✅ 成功遷移: ${migratedCount} 條`)
    console.log(`  ⏭️  跳過（已存在）: ${skippedCount} 條`)
    console.log(`  ❌ 失敗: ${errorCount} 條`)
    console.log(`  📋 總計: ${announcementsSnapshot.docs.length} 條`)
    console.log('='.repeat(50) + '\n')

    if (deleteAfterMigration) {
      console.log('⚠️  注意：原公告已被刪除')
    } else {
      console.log('ℹ️  原公告保留在 announcements 集合中')
      console.log('   如需刪除，請使用 --delete 參數重新運行此腳本')
    }
  } catch (error: any) {
    console.error('❌ 遷移失敗:', error.message)
    throw error
  }
}

/**
 * 主函數
 */
async function main() {
  try {
    // 檢查是否要刪除原公告
    const deleteAfterMigration = process.argv.includes('--delete')

    // 認證
    await authenticate()

    // 執行遷移
    await migrateAnnouncementsToNews(deleteAfterMigration)

    console.log('✅ 遷移完成！')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ 遷移失敗:', error.message)
    process.exit(1)
  }
}

// 執行主函數
main()

