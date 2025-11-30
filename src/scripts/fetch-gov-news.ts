import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, limit } from 'firebase/firestore'
import dotenv from 'dotenv'
import { resolve } from 'path'
import { load } from 'cheerio'
import * as readline from 'readline'

// 載入環境變量
dotenv.config({ path: resolve(process.cwd(), '.env') })

// 初始化 Firebase
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
const auth = getAuth(app)
const db = getFirestore(app)

// 創建 readline 接口
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

// 從命令行參數或環境變量獲取認證信息
function getAuthFromArgs(): { email: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL || process.argv[2]
  const password = process.env.ADMIN_PASSWORD || process.argv[3]
  
  if (email && password) {
    return { email, password }
  }
  return null
}

// 提示用戶輸入認證信息
function promptForAuth(): Promise<{ email: string; password: string }> {
  return new Promise((resolve) => {
    const rl = createReadlineInterface()
    
    rl.question('請輸入管理員電子郵件: ', (email) => {
      rl.question('請輸入管理員密碼: ', (password) => {
        rl.close()
        resolve({ email, password })
      })
    })
  })
}

// 認證用戶
async function authenticate(): Promise<void> {
  console.log('\n🔐 需要管理員認證才能添加公告...\n')
  
  let credentials = getAuthFromArgs()
  
  if (!credentials) {
    credentials = await promptForAuth()
  }
  
  try {
    console.log('正在登入...')
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
    console.log('✅ 認證成功\n')
  } catch (error: any) {
    console.error('\n❌ 認證失敗:', error.message)
    throw error
  }
}

// 火災相關關鍵詞（核心關鍵詞，必須包含）
const CORE_FIRE_KEYWORDS = [
  '火',
  '火警',
  '火災',
  '火災事故',
  '火災現場',
  '宏福苑', // 特定地點
]

// 輔助關鍵詞（如果與核心關鍵詞一起出現，則更可能是相關的）
const SUPPORTING_KEYWORDS = [
  '大埔',
  '宏福',
  '庇護中心',
  '臨時庇護',
  '疏散',
  '消防',
  '救援',
  '緊急',
  '撤離',
]

// 檢查文本是否與火災相關
function isFireRelated(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false
  }
  
  const lowerText = text.toLowerCase()
  
  // 必須包含至少一個核心關鍵詞
  const hasCoreKeyword = CORE_FIRE_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  )
  
  if (hasCoreKeyword) {
    return true
  }
  
  // 如果沒有核心關鍵詞，檢查是否同時包含多個輔助關鍵詞
  // 這可以幫助過濾掉只包含"緊急"或"救援"但與火災無關的新聞
  const supportingCount = SUPPORTING_KEYWORDS.filter(keyword =>
    lowerText.includes(keyword.toLowerCase())
  ).length
  
  // 如果包含 2 個或以上的輔助關鍵詞，且包含"大埔"或"宏福"，則認為相關
  if (supportingCount >= 2) {
    return lowerText.includes('大埔') || lowerText.includes('宏福')
  }
  
  return false
}

// 解析 RSS pubDate 為中文日期格式
function parseRSSDate(pubDate: string): string {
  try {
    const date = new Date(pubDate)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  } catch (error) {
    return new Date().toLocaleDateString('zh-HK')
  }
}

// 清理 HTML 標籤和實體
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // 移除 HTML 標籤
    .replace(/&nbsp;/g, ' ') // 替換 &nbsp;
    .replace(/&amp;/g, '&') // 替換 &amp;
    .replace(/&lt;/g, '<') // 替換 &lt;
    .replace(/&gt;/g, '>') // 替換 &gt;
    .replace(/&quot;/g, '"') // 替換 &quot;
    .replace(/&#39;/g, "'") // 替換 &#39;
    .replace(/\s+/g, ' ') // 合併多個空格
    .trim()
}

// 獲取政府新聞公報（使用 RSS Feed）
async function fetchGovNews(): Promise<Array<{ title: string; url: string; date: string; description?: string; pubDate?: string }>> {
  const rssUrl = 'https://www.info.gov.hk/gia/rss/general_zh.xml'
  
  try {
    console.log(`📰 正在從 RSS Feed 獲取政府新聞: ${rssUrl}`)
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const xml = await response.text()
    const $ = load(xml, { xmlMode: true })
    
    const newsItems: Array<{ title: string; url: string; date: string; description?: string; pubDate?: string }> = []
    
    // 解析 RSS items
    $('item').each((_, element) => {
      const $item = $(element)
      const title = $item.find('title').text().trim()
      const link = $item.find('link').text().trim()
      const pubDate = $item.find('pubDate').text().trim()
      const description = $item.find('description').text().trim()
      
      if (!title || !link) {
        return
      }
      
      // 檢查是否與火災相關（檢查標題和描述）
      const titleRelated = isFireRelated(title)
      const descRelated = isFireRelated(description)
      
      if (titleRelated || descRelated) {
        const date = parseRSSDate(pubDate)
        console.log(`✅ 找到相關新聞: ${title}`)
        newsItems.push({
          title,
          url: link,
          date,
          description: cleanHtml(description),
          pubDate: pubDate || undefined // 保留原始 pubDate 用於時間戳解析
        })
      } else {
        console.log(`⏭️  跳過不相關新聞: ${title}`)
      }
    })
    
    console.log(`✅ 從 RSS Feed 找到 ${newsItems.length} 條相關新聞\n`)
    return newsItems
  } catch (error: any) {
    console.error(`❌ 獲取 RSS Feed 時發生錯誤: ${error.message}`)
    throw new Error(`無法獲取政府新聞 RSS Feed: ${error.message}`)
  }
}

// 獲取新聞詳細內容
async function fetchNewsContent(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = load(html)
    
    // 提取新聞內容（根據實際 HTML 結構調整選擇器）
    let content = ''
    
    // 嘗試多種可能的內容選擇器
    const contentSelectors = [
      '#pressrelease',
      '.pressrelease',
      '#content',
      '.content',
      'article',
      'main'
    ]
    
    for (const selector of contentSelectors) {
      const $content = $(selector)
      if ($content.length > 0) {
        content = $content.text().trim()
        break
      }
    }
    
    // 如果找不到特定容器，嘗試獲取所有段落
    if (!content) {
      $('p').each((_, element) => {
        const text = $(element).text().trim()
        if (text.length > 20) { // 過濾太短的段落
          content += text + '\n\n'
        }
      })
    }
    
    return content.trim() || '無法獲取新聞內容'
  } catch (error: any) {
    console.error(`❌ 獲取新聞內容時發生錯誤 (${url}):`, error.message)
    return '無法獲取新聞內容'
  }
}

// 檢查新聞是否已存在
async function newsExists(title: string, url: string): Promise<boolean> {
  try {
    // 檢查標題或 URL 是否已存在
    const titleQuery = query(
      collection(db, 'news'),
      where('title', '==', title),
      limit(1)
    )
    const titleSnapshot = await getDocs(titleQuery)
    if (!titleSnapshot.empty) {
      return true
    }

    const urlQuery = query(
      collection(db, 'news'),
      where('url', '==', url),
      limit(1)
    )
    const urlSnapshot = await getDocs(urlQuery)
    return !urlSnapshot.empty
  } catch (error) {
    console.error('檢查新聞是否存在時發生錯誤:', error)
    return false
  }
}

// 簡單的備用分類（關鍵詞匹配）
function classifyNewsFallback(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()
  
  if (text.includes('火勢') || text.includes('救援') || text.includes('現場') || text.includes('進展')) {
    return 'event-update'
  }
  if (text.includes('資助') || text.includes('補助') || text.includes('津貼') || text.includes('賠償')) {
    return 'financial-support'
  }
  if (text.includes('心理') || text.includes('輔導') || text.includes('情緒')) {
    return 'emotional-support'
  }
  if (text.includes('庇護') || text.includes('住宿') || text.includes('臨時')) {
    return 'accommodation'
  }
  if (text.includes('醫療') || text.includes('法律')) {
    return 'medical-legal'
  }
  if (text.includes('重建')) {
    return 'reconstruction'
  }
  if (text.includes('死亡') || text.includes('受傷') || text.includes('失蹤') || text.includes('統計')) {
    return 'statistics'
  }
  if (text.includes('義工') || text.includes('物資') || text.includes('社區')) {
    return 'community-support'
  }
  if (text.includes('調查') || text.includes('刑事') || text.includes('貪污')) {
    return 'investigation'
  }
  if (text.includes('政府') || text.includes('官方')) {
    return 'government-announcement'
  }
  return 'general-news'
}

// 添加新聞到 Firestore（使用 news 集合）
async function addNews(news: { title: string; url: string; date: string; description?: string; content?: string; pubDate?: string }) {
  try {
    // 檢查是否已存在
    const exists = await newsExists(news.title, news.url)
    if (exists) {
      console.log(`⏭️  跳過已存在的新聞: ${news.title}`)
      return false
    }
    
    // 使用 description 作為內容，如果沒有則獲取完整內容
    let content = news.description || news.content
    if (!content || content.length < 200) {
      console.log(`📄 正在獲取新聞內容: ${news.title}`)
      try {
        const fullContent = await fetchNewsContent(news.url)
        if (fullContent && fullContent !== '無法獲取新聞內容') {
          content = fullContent
        } else if (!content) {
          content = news.description || '無詳細內容'
        }
      } catch (error: any) {
        console.warn(`獲取完整內容失敗: ${error.message}，使用描述內容`)
        if (!content) {
          content = news.description || '無詳細內容'
        }
      }
    }
    
    // 使用備用分類（本地腳本無法直接調用 Cloud Functions 的 AI 分類）
    const newsCategory = classifyNewsFallback(news.title, content || '')
    
    // 設置標籤
    const tag: 'gov' | 'news' = 'gov' // 政府新聞
    
    // 解析日期和時間
    let timestamp = Timestamp.now()
    try {
      // 優先使用原始 pubDate（包含完整時間信息）
      if (news.pubDate) {
        const parsedDate = new Date(news.pubDate)
        if (!isNaN(parsedDate.getTime())) {
          timestamp = Timestamp.fromDate(parsedDate)
          console.log(`使用 RSS pubDate 解析時間: ${parsedDate.toLocaleString('zh-HK')}`)
        }
      } else {
        // 如果沒有 pubDate，嘗試從格式化的日期字符串解析
        const dateMatch = news.date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
        if (dateMatch) {
          const [, year, month, day] = dateMatch
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          timestamp = Timestamp.fromDate(date)
        }
      }
    } catch (error: any) {
      console.warn(`解析日期時發生錯誤: ${error.message}，使用當前時間`)
    }
    
    const newsItem = {
      title: news.title,
      content: content,
      source: '香港政府新聞公報',
      url: news.url,
      tag,
      newsCategory,
      timestamp
    }
    
    await addDoc(collection(db, 'news'), newsItem)
    console.log(`✅ 已添加新聞: ${news.title} (分類: ${newsCategory})`)
    return true
  } catch (error: any) {
    console.error(`❌ 添加新聞時發生錯誤 (${news.title}):`, error.message)
    return false
  }
}

// 主函數
async function fetchAndAddNews() {
  try {
    // 認證
    await authenticate()
    
    // 獲取新聞
    const newsList = await fetchGovNews()
    
    if (newsList.length === 0) {
      console.log('ℹ️  沒有找到相關的新聞')
      return
    }
    
    console.log('📝 開始處理新聞...\n')
    
    let addedCount = 0
    for (const news of newsList) {
      const added = await addNews(news)
      if (added) {
        addedCount++
      }
      // 添加延遲避免請求過快
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log(`\n✅ 完成！共添加 ${addedCount} 條新公告`)
  } catch (error: any) {
    console.error('\n❌ 執行失敗:', error.message)
    throw error
  }
}

// 執行
fetchAndAddNews()
  .then(() => {
    console.log('\n執行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n執行失敗:', error)
    process.exit(1)
  })

