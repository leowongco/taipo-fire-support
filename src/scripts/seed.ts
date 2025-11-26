import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import dotenv from 'dotenv'
import { resolve } from 'path'

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
console.log(`📋 驗證環境變量...`)

// 驗證所有必需的配置
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig])
if (missingFields.length > 0) {
  throw new Error(`缺少必需的 Firebase 配置: ${missingFields.join(', ')}`)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// 庇護中心與收集點數據
const locations = [
  {
    name: "大埔社區中心",
    address: "大埔鄉事會街2號",
    type: "shelter",
    status: "open",
    google_map_link: "https://goo.gl/maps/example1",
    description: "已開放作臨時庇護中心，提供毛毯及食水。",
    contact: "2654 1263",
    priority: 1
  },
  {
    name: "廣福社區會堂",
    address: "大埔廣福邨",
    type: "collection_point",
    status: "collecting",
    google_map_link: "https://goo.gl/maps/example2",
    description: "物資收集主要站點。",
    contact: "2653 2911",
    priority: 2
  }
]

// 物資需求數據
const supplies = [
  {
    item_name: "N95 / 外科口罩",
    category: "health",
    status: "urgent",
    target_location: "大埔社區中心",
    note: "現場濃煙密布，急需大量口罩供居民使用。",
    current_quantity: 0,
    target_quantity: 500
  },
  {
    item_name: "樽裝水 (500ml)",
    category: "food",
    status: "urgent",
    target_location: "廣福社區會堂",
    note: "方便分發為主。",
    current_quantity: 50,
    target_quantity: 1000
  },
  {
    item_name: "洗眼水 / 生理鹽水",
    category: "medical",
    status: "needed",
    target_location: "大埔社區中心",
    note: "協助清洗受煙薰眼部。",
    current_quantity: 10,
    target_quantity: 100
  }
]

// 將 locations 轉換為 resources 格式（與現有代碼兼容）
const resources = locations.map((loc) => ({
  locationName: loc.name,
  address: loc.address,
  mapLink: loc.google_map_link,
  status: loc.status === 'open' ? 'open' as const : loc.status === 'collecting' ? 'open' as const : 'closed' as const,
  needs: supplies
    .filter(s => s.target_location === loc.name)
    .map(s => s.item_name),
  contact: loc.contact,
  updatedAt: Timestamp.now()
}))

// @ts-expect-error - Function is intentionally unused but kept for future use
async function clearCollection(collectionName: string) {
  try {
    const snapshot = await getDocs(collection(db, collectionName))
    const deletePromises = snapshot.docs.map((docSnapshot) =>
      deleteDoc(doc(db, collectionName, docSnapshot.id))
    )
    await Promise.all(deletePromises)
    console.log(`已清空集合: ${collectionName}`)
  } catch (error) {
    console.error(`清空集合 ${collectionName} 時發生錯誤:`, error)
  }
}

async function seedData() {
  try {
    console.log('開始匯入數據...')

    // 可選：清空現有數據（取消註釋以下行以啟用）
    // await clearCollection('locations')
    // await clearCollection('supplies')
    // await clearCollection('resources')

    // 添加 locations 數據
    const locationPromises = locations.map((location) =>
      addDoc(collection(db, 'locations'), {
        ...location,
        createdAt: Timestamp.now()
      })
    )

    // 添加 supplies 數據
    const supplyPromises = supplies.map((supply) =>
      addDoc(collection(db, 'supplies'), {
        ...supply,
        createdAt: Timestamp.now()
      })
    )

    // 添加 resources 數據（與現有代碼兼容）
    const resourcePromises = resources.map((resource) =>
      addDoc(collection(db, 'resources'), resource)
    )

    // 並行執行所有添加操作
    await Promise.all([
      ...locationPromises,
      ...supplyPromises,
      ...resourcePromises
    ])

    console.log('✅ 數據匯入完成！')
    console.log(`- 已添加 ${locations.length} 個地點到 locations 集合`)
    console.log(`- 已添加 ${supplies.length} 個物資需求到 supplies 集合`)
    console.log(`- 已添加 ${resources.length} 個資源到 resources 集合（與現有代碼兼容）`)
  } catch (error: any) {
    console.error('\n❌ 匯入數據時發生錯誤:')
    console.error('錯誤訊息:', error.message || error)
    
    // 檢查是否為 Firestore API 未啟用的錯誤
    if (error.message?.includes('PERMISSION_DENIED') || error.message?.includes('Cloud Firestore API')) {
      console.error('\n⚠️  問題診斷: Firestore API 尚未在您的 Firebase 項目中啟用')
      console.error('\n📝 解決步驟:')
      console.error('1. 訪問 Firebase Console: https://console.firebase.google.com/')
      console.error(`2. 選擇項目: ${firebaseConfig.projectId}`)
      console.error('3. 前往 Firestore Database 頁面')
      console.error('4. 點擊「建立資料庫」或「啟用 Firestore」')
      console.error('5. 選擇「以測試模式啟動」（稍後可以更新安全規則）')
      console.error('6. 選擇資料庫位置（建議選擇 asia-east1 或 asia-southeast1）')
      console.error('7. 等待幾分鐘讓 API 啟用生效')
      console.error('\n或者直接訪問:')
      console.error(`https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${firebaseConfig.projectId}`)
    }
    
    throw error
  }
}

// 執行匯入
seedData()
  .then(() => {
    console.log('Seeding complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })

