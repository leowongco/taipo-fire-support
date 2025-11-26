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
    console.error('  ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npm run add:shelters')
    console.error('  或')
    console.error('  npm run add:shelters your@email.com yourpassword')
    throw error
  }
}

// 新的庇護中心
const newShelters = [
  {
    locationName: "太和鄰里社區中心",
    address: "大埔太和邨",
    mapLink: "https://www.google.com/maps/search/?api=1&query=太和鄰里社區中心+大埔太和邨",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "東昌街體育館",
    address: "大埔東昌街25號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=東昌街體育館+大埔東昌街25號",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "香港傷健協會 - 新界傷健中心",
    address: "大埔廣福邨廣平樓110-115號地下",
    mapLink: "https://www.google.com/maps/search/?api=1&query=香港傷健協會新界傷健中心+大埔廣福邨",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "東昌街社區會堂",
    address: "大埔東昌街25號大埔東昌街康體大樓1樓",
    mapLink: "https://www.google.com/maps/search/?api=1&query=東昌街社區會堂+大埔",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "大埔社區中心",
    address: "大埔鄉事會街",
    mapLink: "https://www.google.com/maps/search/?api=1&query=大埔社區中心+大埔鄉事會街",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "富善社區會堂",
    address: "大埔安埔路12號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=富善社區會堂+大埔安埔路12號",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "善樓（善導會）",
    address: "大埔船灣陳屋168號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=善導會+大埔船灣陳屋168號",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  },
  {
    locationName: "中華基督教會馮梁結紀念中學",
    address: "大埔普門路22號",
    mapLink: "https://www.google.com/maps/search/?api=1&query=中華基督教會馮梁結紀念中學+大埔",
    status: "open" as const,
    category: "shelter" as const,
    needs: ["毛毯", "食水", "基本物資"],
    contact: "請聯絡大埔民政事務處",
    updatedAt: Timestamp.now()
  }
]

// 需要關閉的庇護中心
const closedShelters = [
  {
    locationName: "廣福社區會堂",
    address: "大埔廣福邨",
    status: "closed" as const
  }
]

async function checkIfExists(locationName: string): Promise<string | null> {
  try {
    const q = query(collection(db, 'resources'), where('locationName', '==', locationName))
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

async function addShelters() {
  try {
    // 先進行認證
    await authenticate()
    
    console.log('開始添加庇護中心...\n')

    // 1. 添加新的庇護中心
    console.log('📝 添加新的庇護中心...')
    let addedCount = 0
    let skippedCount = 0
    
    for (const shelter of newShelters) {
      const existingId = await checkIfExists(shelter.locationName)
      
      if (existingId) {
        // 如果已存在，更新為庇護中心類別和開放狀態
        await updateDoc(doc(db, 'resources', existingId), {
          category: 'shelter',
          status: 'open',
          updatedAt: Timestamp.now()
        })
        console.log(`  ⊙ 已更新: ${shelter.locationName}`)
        skippedCount++
      } else {
        // 如果不存在，創建新的
        await addDoc(collection(db, 'resources'), shelter)
        console.log(`  ✓ 已添加: ${shelter.locationName}`)
        addedCount++
      }
    }

    console.log('')

    // 2. 更新已關閉的庇護中心
    console.log('🔄 更新已關閉的庇護中心狀態...')
    for (const shelter of closedShelters) {
      const existingId = await checkIfExists(shelter.locationName)
      
      if (existingId) {
        await updateDoc(doc(db, 'resources', existingId), {
          status: shelter.status,
          category: 'shelter',
          updatedAt: Timestamp.now()
        })
        console.log(`  ✓ 已更新: ${shelter.locationName} → 已關閉`)
      } else {
        console.log(`  ⚠️  未找到: ${shelter.locationName}`)
      }
    }

    console.log('\n✅ 庇護中心更新完成！')
    console.log(`- 新增: ${addedCount} 個`)
    console.log(`- 更新: ${skippedCount + closedShelters.length} 個`)
  } catch (error: any) {
    console.error('\n❌ 更新數據時發生錯誤:')
    console.error('錯誤訊息:', error.message || error)
    throw error
  }
}

// 執行更新
addShelters()
  .then(() => {
    console.log('\n更新完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n更新失敗:', error)
    process.exit(1)
  })

