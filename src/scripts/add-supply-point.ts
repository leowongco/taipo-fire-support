import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore'
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
    console.error('  ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npm run add:supply')
    console.error('  或')
    console.error('  npm run add:supply your@email.com yourpassword')
    throw error
  }
}

// 檢查是否已存在相同名稱的資源
async function checkIfExists(locationName: string): Promise<string | null> {
  try {
    const q = query(
      collection(db, 'resources'),
      where('locationName', '==', locationName)
    )
    const querySnapshot = await getDocs(q)
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id
    }
    return null
  } catch (error: any) {
    console.error(`檢查 ${locationName} 時發生錯誤:`, error)
    return null
  }
}

// 新的物資收集站
const newSupplyPoint = {
  locationName: "0115 #緊急呼籲 #大埔",
  address: "大埔區",
  mapLink: "https://www.google.com/maps/search/?api=1&query=大埔",
  status: "closed" as const, // 因為內容說已經足夠物資，所以設為已關閉
  category: "supply" as const,
  needs: [] as string[], // 暫時不需要物資
  contact: "",
  updatedAt: Timestamp.now()
}

async function addSupplyPoint() {
  try {
    // 先進行認證
    await authenticate()
    
    console.log('開始添加物資收集站...\n')

    // 檢查是否已存在
    const existingId = await checkIfExists(newSupplyPoint.locationName)
    
    if (existingId) {
      console.log(`  ⊙ 物資收集站已存在: ${newSupplyPoint.locationName}`)
      console.log(`  ID: ${existingId}`)
      console.log('\n如需更新，請使用管理後台進行編輯。')
    } else {
      // 如果不存在，創建新的
      const docRef = await addDoc(collection(db, 'resources'), newSupplyPoint)
      console.log(`  ✓ 已添加物資收集站: ${newSupplyPoint.locationName}`)
      console.log(`  ID: ${docRef.id}`)
      console.log(`  狀態: ${newSupplyPoint.status === 'closed' ? '已關閉' : newSupplyPoint.status === 'open' ? '開放' : '已滿'}`)
      console.log(`  備註: 暫時所有庇護中心或者收留點都已經足夠物資及人手`)
    }

    console.log('\n✅ 物資收集站更新完成！')
  } catch (error: any) {
    console.error('\n❌ 更新數據時發生錯誤:')
    console.error('錯誤訊息:', error.message || error)
    throw error
  }
}

// 執行更新
addSupplyPoint()
  .then(() => {
    console.log('\n更新完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n更新失敗')
    process.exit(1)
  })

