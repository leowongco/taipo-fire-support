import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore'
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

// 火災相關關鍵詞
const FIRE_KEYWORDS = [
  '火', '火警', '火災', '火災事故', '火災現場',
  '大埔', '宏福苑', '宏福', '庇護中心', '臨時庇護', '疏散',
  '消防', '救援', '緊急', '撤離', '五級火', '四級火', '三級火', '二級火', '一級火'
]

// 檢查文本是否與火災相關
function isFireRelated(text: string): boolean {
  const lowerText = text.toLowerCase()
  return FIRE_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()))
}

// 解析 RSS XML 日期
function parseRSSDate(dateString: string): Date {
  try {
    // RSS 日期格式通常是: "Thu, 27 Nov 2025 01:20:24 +0800"
    return new Date(dateString)
  } catch (error) {
    console.warn(`無法解析日期: ${dateString}`)
    return new Date()
  }
}

// 獲取 RTHK RSS 新聞
async function fetchRTHKNews(): Promise<Array<{ title: string; url: string; date: string; description: string }>> {
  try {
    const rssUrl = 'https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml'
    console.log(`📰 正在獲取 RTHK RSS: ${rssUrl}`)
    
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
    
    const newsItems: Array<{ title: string; url: string; date: string; description: string }> = []
    
    // 解析 RSS items
    $('item').each((_, element) => {
      const $item = $(element)
      const title = $item.find('title').text().trim()
      const link = $item.find('link').text().trim()
      const description = $item.find('description').text().trim()
      const pubDate = $item.find('pubDate').text().trim()
      const guid = $item.find('guid').text().trim()
      
      // 使用 link 或 guid 作為 URL
      const url = link || guid
      
      if (!title || !url) {
        return
      }
      
      // 檢查標題或描述是否與火災相關
      const titleRelated = isFireRelated(title)
      const descRelated = description && isFireRelated(description)
      
      if (titleRelated || descRelated) {
        // 解析日期
        let dateStr = new Date().toLocaleDateString('zh-HK')
        if (pubDate) {
          try {
            const date = parseRSSDate(pubDate)
            dateStr = date.toLocaleDateString('zh-HK', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          } catch (error) {
            // 使用當前日期
          }
        }
        
        newsItems.push({
          title,
          url,
          date: dateStr,
          description: description || ''
        })
      }
    })
    
    console.log(`✅ 找到 ${newsItems.length} 條相關新聞\n`)
    return newsItems
  } catch (error: any) {
    console.error('❌ 獲取 RTHK RSS 時發生錯誤:', error.message)
    throw error
  }
}

// 獲取新聞詳細內容（如果需要）
async function fetchNewsContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = load(html)
    
    let content = ''
    
    // 嘗試多種可能的內容選擇器
    const contentSelectors = [
      '.article-content',
      '.content',
      '#content',
      'article',
      '.news-content',
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
        if (text.length > 20) {
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

// 檢查公告是否已存在
async function announcementExists(title: string, url: string): Promise<boolean> {
  try {
    // 檢查標題或 URL 是否已存在
    const titleQuery = query(
      collection(db, 'announcements'),
      where('title', '==', title),
      limit(1)
    )
    const titleSnapshot = await getDocs(titleQuery)
    
    if (!titleSnapshot.empty) {
      return true
    }
    
    const urlQuery = query(
      collection(db, 'announcements'),
      where('url', '==', url),
      limit(1)
    )
    const urlSnapshot = await getDocs(urlQuery)
    
    return !urlSnapshot.empty
  } catch (error) {
    console.error('檢查公告是否存在時發生錯誤:', error)
    return false
  }
}

// 添加公告到 Firestore
async function addAnnouncement(news: { title: string; url: string; date: string; description: string; content?: string }) {
  try {
    // 檢查是否已存在
    const exists = await announcementExists(news.title, news.url)
    if (exists) {
      console.log(`⏭️  跳過已存在的公告: ${news.title}`)
      return false
    }
    
    // 獲取新聞內容（如果描述太短，嘗試獲取完整內容）
    let content = news.description
    if (!news.content && (news.description.length < 100 || !news.description)) {
      console.log(`📄 正在獲取新聞內容: ${news.title}`)
      try {
        const fullContent = await fetchNewsContent(news.url)
        if (fullContent && fullContent !== '無法獲取新聞內容') {
          content = fullContent
        } else {
          content = news.description || '無詳細內容'
        }
      } catch (error) {
        content = news.description || '無詳細內容'
      }
    } else if (news.content) {
      content = news.content
    }
    
    // 判斷是否為緊急
    // 優先檢查是否包含緊急公告的標準格式文字
    const urgentAnnouncementText = '電台及電視台當值宣布員注意';
    const hasUrgentAnnouncementFormat = 
      news.title.includes(urgentAnnouncementText) || 
      content.includes(urgentAnnouncementText) ||
      news.description.includes(urgentAnnouncementText);
    
    const isUrgent = 
      hasUrgentAnnouncementFormat || // 包含緊急公告格式文字，直接標記為緊急
      (isFireRelated(news.title) && (
        news.title.includes('緊急') || 
        news.title.includes('火警') || 
        news.title.includes('火災') ||
        news.title.includes('五級火') ||
        news.title.includes('四級火') ||
        content.includes('緊急') ||
        content.includes('撤離') ||
        content.includes('死亡') ||
        content.includes('失聯')
      ))
    
    // 設置標籤
    let tag: 'urgent' | 'gov' | 'news' = 'news' // 默認為新聞（來自 RTHK）
    if (isUrgent) {
      tag = 'urgent' // 緊急新聞
    }
    
    // 解析日期
    let timestamp = Timestamp.now()
    try {
      const dateMatch = news.date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
      if (dateMatch) {
        const [, year, month, day] = dateMatch
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        timestamp = Timestamp.fromDate(date)
      } else {
        // 嘗試解析其他日期格式
        const parsedDate = parseRSSDate(news.date)
        if (!isNaN(parsedDate.getTime())) {
          timestamp = Timestamp.fromDate(parsedDate)
        }
      }
    } catch (error) {
      // 使用當前時間
    }
    
    const announcement = {
      title: news.title,
      content: content,
      source: '香港電台 (RTHK)',
      url: news.url,
      isUrgent,
      tag,
      timestamp
    }
    
    await addDoc(collection(db, 'announcements'), announcement)
    console.log(`✅ 已添加公告: ${news.title}`)
    return true
  } catch (error: any) {
    console.error(`❌ 添加公告時發生錯誤 (${news.title}):`, error.message)
    return false
  }
}

// 主函數
async function fetchAndAddNews() {
  try {
    // 認證
    await authenticate()
    
    // 獲取新聞
    const newsList = await fetchRTHKNews()
    
    if (newsList.length === 0) {
      console.log('ℹ️  沒有找到相關的新聞')
      return
    }
    
    console.log('📝 開始處理新聞...\n')
    
    let addedCount = 0
    for (const news of newsList) {
      const added = await addAnnouncement(news)
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

