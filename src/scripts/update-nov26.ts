import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, Timestamp } from 'firebase/firestore'
import dotenv from 'dotenv'
import { resolve } from 'path'
import * as readline from 'readline'

// 載入環境變量
dotenv.config({ path: resolve(process.cwd(), '.env') })

// 初始化 Firebase（用於 Node.js 環境）
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

// 創建 readline 接口用於輸入
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
  console.log('\n🔐 需要管理員認證才能更新數據...\n')
  
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
    console.error('\n請確保：')
    console.error('1. 電子郵件和密碼正確')
    console.error('2. 該帳戶已在 Firebase Authentication 中創建')
    console.error('3. 該帳戶具有管理員權限')
    console.error('\n或者使用環境變量或命令行參數：')
    console.error('  ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npm run update:nov26')
    console.error('  或')
    console.error('  npm run update:nov26 your@email.com yourpassword')
    throw error
  }
}

// 新公告
const newAnnouncement = {
  title: "加開臨時庇護中心和跨部門援助站（二）",
  content: `因應大埔宏福苑火警事故，大埔民政事務處今日（十一月二十六日）表示，現已為有需要人士加開以下臨時庇護中心：

名稱	地址
太和鄰里社區中心	大埔太和邨
東昌街體育館	大埔東昌街25號
香港傷健協會新界傷健中心	大埔廣福邨廣平樓110-115號地下

大埔民政事務處今日較早前已開放廣福社區會堂（大埔廣福邨）、東昌街社區會堂（大埔東昌街25號大埔東昌街康體大樓1樓）、大埔社區中心（大埔鄉事會街）、富善社區會堂（大埔安埔路12號）和善樓（善導會）（大埔船灣陳屋168號）作臨時庇護中心，予有需要的市民使用。中華基督教會馮梁結紀念中學亦已開放以安置疏散居民。

因應警方行動，今日較早前已開放的廣福社區會堂臨時庇護中心（大埔廣福邨）現已關閉。

除了大埔民政事務處早前在雅麗氏何妙齡那打素醫院設立的跨部門援助站（熱線：2658 4040）和沙田民政事務處在威爾斯親王醫院設立跨部門援助站（熱線：3505 1555），北區民政事務處亦已在北區醫院設立跨部門援助站（熱線：2683 7567），為市民提供協助及供市民查詢。

民政處會繼續密切留意情況，會按需要加開臨時庇護中心，並繼續與其他政府部門聯繫，為市民提供適切協助。`,
  source: "大埔民政事務處",
  isUrgent: true,
  tag: 'urgent' as const, // 緊急標籤
  timestamp: Timestamp.fromDate(new Date('2025-11-26T23:42:00+08:00'))
}

// 新的庇護中心
const newShelters = [
  {
    locationName: "太和鄰里社區中心",
    address: "大埔太和邨",
    mapLink: "https://www.google.com/maps/search/?api=1&query=太和鄰里社區中心+大埔太和邨",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "東昌街體育館",
    address: "大埔東昌街25號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=東昌街體育館+大埔東昌街25號",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "香港傷健協會新界傷健中心",
    address: "大埔廣福邨廣平樓110-115號地下",
    mapLink: "https://www.google.com/maps/search/?api=1&query=香港傷健協會新界傷健中心+大埔廣福邨",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "東昌街社區會堂",
    address: "大埔東昌街25號大埔東昌街康體大樓1樓",
    mapLink: "https://www.google.com/maps/search/?api=1&query=東昌街社區會堂+大埔",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "富善社區會堂",
    address: "大埔安埔路12號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=富善社區會堂+大埔安埔路12號",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "善樓（善導會）",
    address: "大埔船灣陳屋168號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=善導會+大埔船灣陳屋168號",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "中華基督教會馮梁結紀念中學",
    address: "大埔（用於安置疏散居民）",
    mapLink: "https://www.google.com/maps/search/?api=1&query=中華基督教會馮梁結紀念中學+大埔",
    status: "open" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  }
]

// 跨部門援助站
const assistanceStations = [
  {
    locationName: "雅麗氏何妙齡那打素醫院 - 跨部門援助站",
    address: "雅麗氏何妙齡那打素醫院",
    mapLink: "https://www.google.com/maps/search/?api=1&query=雅麗氏何妙齡那打素醫院",
    status: "open" as const,
    needs: ["查詢", "協助"],
    contact: "熱線：2658 4040",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "威爾斯親王醫院 - 跨部門援助站",
    address: "威爾斯親王醫院",
    mapLink: "https://www.google.com/maps/search/?api=1&query=威爾斯親王醫院",
    status: "open" as const,
    needs: ["查詢", "協助"],
    contact: "熱線：3505 1555",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "北區醫院 - 跨部門援助站",
    address: "北區醫院",
    mapLink: "https://www.google.com/maps/search/?api=1&query=北區醫院",
    status: "open" as const,
    needs: ["查詢", "協助"],
    contact: "熱線：2683 7567",
    updatedAt: Timestamp.now()
  }
]

async function updateResourceStatus(locationName: string, status: 'open' | 'closed' | 'full') {
  try {
    const q = query(collection(db, 'resources'), where('locationName', '==', locationName))
    const snapshot = await getDocs(q)
    
    if (!snapshot.empty) {
      const updatePromises = snapshot.docs.map((docSnapshot) =>
        updateDoc(doc(db, 'resources', docSnapshot.id), {
          status,
          updatedAt: Timestamp.now()
        })
      )
      await Promise.all(updatePromises)
      console.log(`✅ 已更新 ${locationName} 狀態為: ${status}`)
    } else {
      console.log(`⚠️  未找到 ${locationName}，將跳過更新`)
    }
  } catch (error) {
    console.error(`❌ 更新 ${locationName} 狀態時發生錯誤:`, error)
  }
}

async function addUpdate() {
  try {
    // 先進行認證
    await authenticate()
    
    console.log('開始更新數據...\n')

    // 1. 添加新公告
    console.log('📢 添加新公告...')
    await addDoc(collection(db, 'announcements'), newAnnouncement)
    console.log('✅ 已添加公告: 加開臨時庇護中心和跨部門援助站（二）\n')

    // 2. 更新廣福社區會堂狀態為關閉
    console.log('🔄 更新庇護中心狀態...')
    await updateResourceStatus('廣福社區會堂', 'closed')
    console.log('')

    // 3. 添加新的庇護中心
    console.log('🏠 添加新的庇護中心...')
    const shelterPromises = newShelters.map((shelter) =>
      addDoc(collection(db, 'resources'), shelter)
    )
    await Promise.all(shelterPromises)
    console.log(`✅ 已添加 ${newShelters.length} 個新庇護中心\n`)

    // 4. 添加跨部門援助站
    console.log('🏥 添加跨部門援助站...')
    const stationPromises = assistanceStations.map((station) =>
      addDoc(collection(db, 'resources'), station)
    )
    await Promise.all(stationPromises)
    console.log(`✅ 已添加 ${assistanceStations.length} 個跨部門援助站\n`)

    console.log('✅ 數據更新完成！')
    console.log(`- 已添加 1 個新公告`)
    console.log(`- 已更新 1 個庇護中心狀態（廣福社區會堂 → 已關閉）`)
    console.log(`- 已添加 ${newShelters.length} 個新庇護中心`)
    console.log(`- 已添加 ${assistanceStations.length} 個跨部門援助站`)
  } catch (error: any) {
    console.error('\n❌ 更新數據時發生錯誤:')
    console.error('錯誤訊息:', error.message || error)
    throw error
  }
}

// 執行更新
addUpdate()
  .then(() => {
    console.log('\n更新完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n更新失敗:', error)
    process.exit(1)
  })

