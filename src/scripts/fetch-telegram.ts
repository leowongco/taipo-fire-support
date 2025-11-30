import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, limit, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
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
  console.log('\n🔐 需要管理員認證才能添加資源點...\n')
  
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

// ==================== Telegram 解析工具 ====================

interface ParsedResource {
  locationName: string
  address: string
  mapLink: string
  category: 'supply' | 'shelter'
  status: 'open' | 'closed' | 'full'
  needs: string[]
  contact: string
  source: string
  sourceUrl?: string
}

function extractAddress(text: string): string {
  const addressPatterns = [
    /([大埔|新界|香港].*?(?:街|路|道|邨|村|中心|會堂|廣場|大廈|樓|號))/g,
    /(.*?(?:社區中心|社區會堂|體育館|活動中心|中心|會堂))/g,
  ]

  for (const pattern of addressPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  const locationPatterns = [
    /([大埔|新界].*?(?:中心|會堂|體育館|活動中心))/g,
  ]

  for (const pattern of locationPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  return ''
}

function extractMapLink(text: string): string {
  const mapPatterns = [
    /(https?:\/\/[^\s]*(?:maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*)/g,
    /(https?:\/\/[^\s]*(?:openstreetmap|osm)[^\s]*)/g,
  ]

  for (const pattern of mapPatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }

  const address = extractAddress(text)
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }

  return ''
}

function extractContact(text: string): string {
  const phonePattern = /(\d{4}\s?\d{4}|\d{8})/g
  const matches = text.match(phonePattern)
  if (matches && matches.length > 0) {
    return matches[0].replace(/\s/g, '')
  }

  const contactPatterns = [
    /聯絡[：:]\s*([^\n]+)/,
    /電話[：:]\s*([^\n]+)/,
    /Contact[：:]\s*([^\n]+)/i,
  ]

  for (const pattern of contactPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return ''
}

function extractNeeds(text: string): string[] {
  const needs: string[] = []
  
  const supplyKeywords = [
    '水', '樽裝水', '食水', '飲用水',
    '口罩', 'N95', '外科口罩',
    '毛巾', '毛毯', '被', '毯',
    '食物', '乾糧', '餅乾', '麵包',
    '生理鹽水', '洗眼水', '眼藥水',
    '濕紙巾', '紙巾',
    '充電器', '充電寶', '行動電源',
    '手電筒', '電筒',
  ]

  for (const keyword of supplyKeywords) {
    if (text.includes(keyword)) {
      needs.push(keyword)
    }
  }

  const needsPatterns = [
    /需要[：:]\s*([^\n]+)/,
    /物資[：:]\s*([^\n]+)/,
    /需求[：:]\s*([^\n]+)/,
  ]

  for (const pattern of needsPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const items = match[1]
        .split(/[、,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
      needs.push(...items)
    }
  }

  return [...new Set(needs)]
}

function determineCategory(text: string): 'supply' | 'shelter' {
  const lowerText = text.toLowerCase()

  const shelterKeywords = [
    '庇護', '避難', '臨時住宿', '住宿', '過夜',
    '休息', '暫住', '收容',
  ]

  const supplyKeywords = [
    '物資收集', '收集站', '收集點', '捐贈',
    '物資', '收集', '捐',
  ]

  const shelterCount = shelterKeywords.filter((keyword) =>
    lowerText.includes(keyword)
  ).length
  const supplyCount = supplyKeywords.filter((keyword) =>
    lowerText.includes(keyword)
  ).length

  if (shelterCount > 0 && shelterCount >= supplyCount) {
    return 'shelter'
  }

  return 'supply'
}

function determineStatus(text: string): 'open' | 'closed' | 'full' {
  const lowerText = text.toLowerCase()

  if (lowerText.includes('已滿') || lowerText.includes('滿額') || lowerText.includes('額滿')) {
    return 'full'
  }

  if (
    lowerText.includes('已關閉') ||
    lowerText.includes('關閉') ||
    lowerText.includes('停止')
  ) {
    return 'closed'
  }

  return 'open'
}

function extractLocationName(text: string): string {
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    const cleaned = firstLine
      .replace(/^[⚠️⚠️⚠️]*\s*/, '')
      .replace(/^號外\s*/, '')
      .replace(/^注意\s*/, '')
      .trim()

    if (cleaned.length > 0 && cleaned.length < 50) {
      return cleaned
    }
  }

  const address = extractAddress(text)
  if (address) {
    return address
  }

  return '未命名地點'
}

function parseTelegramPost(
  text: string,
  messageId?: number,
  channelUsername?: string
): ParsedResource | null {
  if (!text || text.trim().length === 0) {
    return null
  }

  const locationName = extractLocationName(text)
  const address = extractAddress(text)
  const mapLink = extractMapLink(text)
  const category = determineCategory(text)
  const status = determineStatus(text)
  const needs = extractNeeds(text)
  const contact = extractContact(text)

  if (!locationName && !address) {
    return null
  }

  const sourceUrl = channelUsername
    ? `https://t.me/${channelUsername}/${messageId || ''}`
    : undefined

  return {
    locationName: locationName || address || '未命名地點',
    address: address || locationName || '',
    mapLink: mapLink || '',
    category,
    status,
    needs,
    contact,
    source: '銀河系哨俠頻道',
    sourceUrl,
  }
}

// ==================== Telegram 消息獲取 ====================

async function scrapeTelegramChannel(
  channelUsername: string,
  limit: number = 20,
  retries: number = 3
): Promise<Array<{ text: string; date: number; messageId: number; link: string }>> {
  const channelUrl = `https://t.me/s/${channelUsername.replace('@', '')}`
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 正在獲取 Telegram 頻道 (嘗試 ${attempt}/${retries}): ${channelUrl}`)
      
      // 使用 AbortController 設置超時
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超時
      
      const response = await fetch(channelUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      const $ = load(html)
      
      const messages: Array<{ text: string; date: number; messageId: number; link: string }> = []
      
      // 使用 cheerio 解析 Telegram 網頁版
      $('.tgme_widget_message').each((_, element) => {
        if (messages.length >= limit) return false
        
        const $msg = $(element)
        const postId = $msg.attr('data-post')
        if (!postId) return
        
        const messageId = parseInt(postId.split('/')[1] || '0')
        if (!messageId) return
        
        // 提取文本
        const text = $msg.find('.tgme_widget_message_text').text().trim()
        if (!text) return
        
        // 提取時間
        const timeStr = $msg.find('time').attr('datetime')
        const date = timeStr ? new Date(timeStr).getTime() / 1000 : Date.now() / 1000
        
        messages.push({
          text,
          date: Math.floor(date),
          messageId,
          link: `https://t.me/${channelUsername.replace('@', '')}/${messageId}`,
        })
      })

      console.log(`✅ 獲取到 ${messages.length} 條消息\n`)
      return messages
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏱️  請求超時 (嘗試 ${attempt}/${retries})`)
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error(`🌐 網絡連接失敗 (嘗試 ${attempt}/${retries}): ${error.message}`)
      } else {
        console.error(`❌ 獲取失敗 (嘗試 ${attempt}/${retries}): ${error.message}`)
      }
      
      // 如果不是最後一次嘗試，等待後重試
      if (attempt < retries) {
        const waitTime = attempt * 2000 // 遞增等待時間：2秒、4秒、6秒
        console.log(`⏳ 等待 ${waitTime / 1000} 秒後重試...\n`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        // 最後一次嘗試失敗，提供更多幫助信息
        console.error('\n❌ 所有重試都失敗了。可能的原因：')
        console.error('   1. 網絡連接問題')
        console.error('   2. Telegram 服務器暫時不可用')
        console.error('   3. 需要代理或 VPN')
        console.error('   4. 防火牆阻止了連接')
        console.error('\n💡 建議：')
        console.error('   - 檢查網絡連接')
        console.error('   - 嘗試使用 VPN')
        console.error('   - 稍後再試')
        throw new Error(`無法連接到 Telegram 頻道，已重試 ${retries} 次`)
      }
    }
  }
  
  // 理論上不會到達這裡，但為了類型安全
  return []
}

// ==================== 主函數 ====================

async function fetchAndProcessTelegram() {
  try {
    // 認證
    await authenticate()

    const channelUsername = 'universalsentinelsinblack'
    console.log(`\n🔍 開始處理 Telegram 頻道: @${channelUsername}\n`)

    // 獲取消息
    const messages = await scrapeTelegramChannel(channelUsername, 20)

    if (messages.length === 0) {
      console.log('⚠️  未獲取到任何消息')
      return
    }

    // 獲取已處理的消息 ID
    const processedRef = doc(db, '_metadata', 'telegram_processed')
    const processedDoc = await getDoc(processedRef)
    const processedIds = processedDoc.exists()
      ? (processedDoc.data()?.messageIds || [])
      : []

    console.log(`📊 已處理的消息數: ${processedIds.length}`)
    console.log(`📊 新消息數: ${messages.length}\n`)

    let newCount = 0
    let updatedCount = 0
    let skippedCount = 0
    const newProcessedIds: number[] = [...processedIds]

    // 處理每條消息
    for (const message of messages) {
      // 跳過已處理的消息
      if (processedIds.includes(message.messageId)) {
        skippedCount++
        continue
      }

      console.log(`\n📝 處理消息 #${message.messageId}`)
      console.log(`   連結: ${message.link}`)
      console.log(`   預覽: ${message.text.substring(0, 50)}...`)

      // 解析消息
      const parsed = parseTelegramPost(
        message.text,
        message.messageId,
        channelUsername
      )

      if (!parsed) {
        console.log('   ⚠️  無法解析，跳過')
        newProcessedIds.push(message.messageId)
        skippedCount++
        continue
      }

      console.log(`   ✅ 解析成功:`)
      console.log(`      地點: ${parsed.locationName}`)
      console.log(`      地址: ${parsed.address}`)
      console.log(`      類別: ${parsed.category === 'supply' ? '物資收集站' : '庇護中心'}`)
      console.log(`      狀態: ${parsed.status}`)
      if (parsed.needs.length > 0) {
        console.log(`      需要物資: ${parsed.needs.join(', ')}`)
      }

      // 檢查是否已存在
      const existingQuery = await getDocs(
        query(
          collection(db, 'resources'),
          where('address', '==', parsed.address),
          where('locationName', '==', parsed.locationName),
          limit(1)
        )
      )

      if (!existingQuery.empty) {
        // 更新現有資源點
        const existingDoc = existingQuery.docs[0]
        await updateDoc(existingDoc.ref, {
          ...parsed,
          updatedAt: Timestamp.fromMillis(message.date * 1000),
          sourceUrl: message.link,
        })
        console.log(`   🔄 更新現有資源點`)
        updatedCount++
      } else {
        // 創建新資源點
        await addDoc(collection(db, 'resources'), {
          ...parsed,
          updatedAt: Timestamp.fromMillis(message.date * 1000),
          timestamp: Timestamp.fromMillis(message.date * 1000),
        })
        console.log(`   ✨ 創建新資源點`)
        newCount++
      }

      newProcessedIds.push(message.messageId)
    }

    // 更新已處理的消息 ID（只保留最近 1000 條）
    const trimmedIds = newProcessedIds.slice(-1000)
    await setDoc(processedRef, {
      messageIds: trimmedIds,
      lastUpdate: Timestamp.now(),
    })

    // 輸出結果
    console.log('\n' + '='.repeat(50))
    console.log('📊 處理結果:')
    console.log(`   ✨ 新增: ${newCount} 個資源點`)
    console.log(`   🔄 更新: ${updatedCount} 個資源點`)
    console.log(`   ⏭️  跳過: ${skippedCount} 條消息`)
    console.log(`   📝 總計: ${messages.length} 條消息`)
    console.log('='.repeat(50) + '\n')

    console.log('✅ 完成！')
  } catch (error: any) {
    console.error('\n❌ 發生錯誤:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 執行
fetchAndProcessTelegram()

