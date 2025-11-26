import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, Timestamp } from 'firebase/firestore'
import dotenv from 'dotenv'
import { resolve } from 'path'

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

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// 從環境變量獲取認證信息
function getAuthFromArgs(): { email: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL || process.argv[2]
  const password = process.env.ADMIN_PASSWORD || process.argv[3]
  
  if (email && password) {
    return { email, password }
  }
  return null
}

// 認證用戶
async function authenticate(): Promise<void> {
  const credentials = getAuthFromArgs()
  
  if (!credentials) {
    throw new Error('請設置 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變量')
  }
  
  try {
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
    console.log('✅ 認證成功\n')
  } catch (error: any) {
    console.error('❌ 認證失敗:', error.message)
    throw error
  }
}

// 庇護中心相關關鍵詞
const SHELTER_KEYWORDS = [
  '庇護中心',
  '臨時庇護中心',
  '臨時庇護',
  '社區會堂',
  '社區中心',
  '體育館',
  '活動中心',
  '鄰里社區中心',
  '會堂',
  '中心',
  '學校',
  '書院',
  '中學',
  '小學',
  '幼稚園',
  '過渡性房屋',
  '臨時收容中心'
]

// 狀態關鍵詞
const STATUS_KEYWORDS = {
  open: ['開放', '啟用', '啟用', '開始運作', '投入服務', '提供服務', '可以使用', '可以使用'],
  closed: ['關閉', '停止', '結束', '暫停', '停止運作', '停止服務', '不再提供'],
  full: ['已滿', '額滿', '滿額', '已爆滿', '已滿額', '無法容納', '已無空位']
}

// 地址關鍵詞
const ADDRESS_KEYWORDS = [
  '大埔',
  '地址',
  '位於',
  '設於',
  '地點',
  '位置',
  '在',
  '邨',
  '路',
  '街',
  '道',
  '號'
]

// 檢查文本是否與庇護中心相關
function isShelterRelated(text: string): boolean {
  const lowerText = text.toLowerCase()
  return SHELTER_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()))
}

// 從文本中提取庇護中心名稱
function extractShelterNames(text: string): string[] {
  const names: string[] = []
  
  // 匹配模式：關鍵詞 + 名稱（通常是中文名稱）
  const patterns = [
    // 匹配「XX社區會堂」、「XX社區中心」等
    /([\u4e00-\u9fa5]+(?:社區會堂|社區中心|鄰里社區中心|會堂|中心|體育館|活動中心))/g,
    // 匹配「XX學校」、「XX書院」等
    /([\u4e00-\u9fa5]+(?:學校|書院|中學|小學|幼稚園))/g,
    // 匹配「XX邨XX樓」等
    /([\u4e00-\u9fa5]+邨[\u4e00-\u9fa5]*)/g,
    // 匹配「XX路XX號」等
    /([\u4e00-\u9fa5]+(?:路|街|道)[\u4e00-\u9fa5]*)/g,
  ]
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => {
        // 過濾掉太短或太長的名稱
        if (match.length >= 3 && match.length <= 30) {
          names.push(match.trim())
        }
      })
    }
  })
  
  // 去重
  return [...new Set(names)]
}

// 從文本中提取地址
function extractAddress(text: string, shelterName: string): string {
  // 嘗試在庇護中心名稱附近找到地址
  const nameIndex = text.indexOf(shelterName)
  if (nameIndex === -1) return ''
  
  // 在名稱前後各取 100 個字符
  const start = Math.max(0, nameIndex - 100)
  const end = Math.min(text.length, nameIndex + shelterName.length + 100)
  const context = text.substring(start, end)
  
  // 匹配地址模式
  const addressPatterns = [
    /([\u4e00-\u9fa5]+(?:邨|路|街|道)[\u4e00-\u9fa5]*\d*號?)/g,
    /(大埔[\u4e00-\u9fa5]+(?:邨|路|街|道)[\u4e00-\u9fa5]*)/g,
  ]
  
  for (const pattern of addressPatterns) {
    const matches = context.match(pattern)
    if (matches && matches.length > 0) {
      return matches[0].trim()
    }
  }
  
  // 如果找不到具體地址，返回包含「大埔」的上下文
  if (context.includes('大埔')) {
    const match = context.match(/大埔[\u4e00-\u9fa5]+/)
    if (match) {
      return match[0]
    }
  }
  
  return '大埔'
}

// 判斷狀態
function determineStatus(text: string): 'open' | 'closed' | 'full' | null {
  const lowerText = text.toLowerCase()
  
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      return status as 'open' | 'closed' | 'full'
    }
  }
  
  return null
}

// 生成 Google Maps 連結
function generateMapLink(locationName: string, address: string): string {
  const query = encodeURIComponent(`${locationName} ${address}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

// 檢查庇護中心是否已存在
async function checkIfShelterExists(locationName: string): Promise<string | null> {
  try {
    const q = query(
      collection(db, 'resources'),
      where('locationName', '==', locationName),
      where('category', '==', 'shelter')
    )
    const snapshot = await getDocs(q)
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id
    }
    return null
  } catch (error) {
    console.error(`檢查 ${locationName} 時發生錯誤:`, error)
    return null
  }
}

// 更新或創建庇護中心
async function updateOrCreateShelter(
  locationName: string,
  address: string,
  status: 'open' | 'closed' | 'full' | null,
  existingId: string | null,
  sourceUrl?: string
): Promise<boolean> {
  try {
    const mapLink = generateMapLink(locationName, address)
    const updateData: any = {
      locationName,
      address,
      mapLink,
      category: 'shelter',
      needs: ['毛毯', '食水', '基本物資'],
      contact: '請聯絡大埔民政事務處',
      updatedAt: Timestamp.now(),
    }
    
    if (status) {
      updateData.status = status
    } else if (!existingId) {
      // 新創建的默認為開放
      updateData.status = 'open'
    }
    
    if (sourceUrl) {
      updateData.sourceUrl = sourceUrl
    }
    
    if (existingId) {
      // 更新現有庇護中心
      await updateDoc(doc(db, 'resources', existingId), updateData)
      console.log(`  ✓ 已更新: ${locationName}${status ? ` (狀態: ${status})` : ''}`)
      return true
    } else {
      // 創建新庇護中心
      updateData.timestamp = Timestamp.now()
      await addDoc(collection(db, 'resources'), updateData)
      console.log(`  ✓ 已創建: ${locationName}${status ? ` (狀態: ${status})` : ''}`)
      return true
    }
  } catch (error: any) {
    console.error(`  ❌ 處理 ${locationName} 時發生錯誤:`, error.message)
    return false
  }
}

// 分析政府新聞並更新庇護中心
async function analyzeSheltersFromNews() {
  try {
    // 認證
    await authenticate()
    
    console.log('🔍 開始分析政府新聞中的庇護中心資訊...\n')
    
    // 獲取最近 24 小時內添加的政府新聞
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)
    const yesterdayTimestamp = Timestamp.fromDate(yesterday)
    
    const announcementsQuery = query(
      collection(db, 'announcements'),
      where('source', '==', '香港政府新聞公報'),
      where('timestamp', '>=', yesterdayTimestamp)
    )
    
    const snapshot = await getDocs(announcementsQuery)
    
    if (snapshot.empty) {
      console.log('ℹ️  沒有找到最近 24 小時內的政府新聞')
      return { analyzed: 0, updated: 0, created: 0 }
    }
    
    console.log(`📰 找到 ${snapshot.size} 條政府新聞，開始分析...\n`)
    
    let analyzedCount = 0
    let updatedCount = 0
    let createdCount = 0
    
    for (const docSnapshot of snapshot.docs) {
      const announcement = docSnapshot.data()
      const title = announcement.title || ''
      const content = announcement.content || ''
      const url = announcement.url || ''
      
      // 檢查是否與庇護中心相關
      if (!isShelterRelated(title) && !isShelterRelated(content)) {
        continue
      }
      
      analyzedCount++
      console.log(`\n📄 分析新聞: ${title}`)
      
      // 提取庇護中心名稱
      const shelterNames = extractShelterNames(title + ' ' + content)
      
      if (shelterNames.length === 0) {
        console.log('  ⚠️  未能提取庇護中心名稱')
        continue
      }
      
      // 判斷狀態
      const status = determineStatus(title + ' ' + content)
      
      // 處理每個庇護中心
      for (const shelterName of shelterNames) {
        const address = extractAddress(content, shelterName)
        const existingId = await checkIfShelterExists(shelterName)
        const result = await updateOrCreateShelter(shelterName, address, status, existingId, url)
        
        if (result) {
          if (existingId) {
            updatedCount++
          } else {
            createdCount++
          }
        }
        
        // 添加延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log('\n✅ 分析完成！')
    console.log(`- 分析新聞: ${analyzedCount} 條`)
    console.log(`- 更新庇護中心: ${updatedCount} 個`)
    console.log(`- 創建庇護中心: ${createdCount} 個`)
    
    return {
      analyzed: analyzedCount,
      updated: updatedCount,
      created: createdCount
    }
  } catch (error: any) {
    console.error('\n❌ 分析時發生錯誤:', error.message)
    throw error
  }
}

// 執行分析
if (require.main === module) {
  analyzeSheltersFromNews()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n執行失敗:', error)
      process.exit(1)
    })
}

export { analyzeSheltersFromNews }

