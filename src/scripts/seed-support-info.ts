import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore'
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
  console.log('\n🔐 需要管理員認證才能匯入數據...\n')
  
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
    console.error('  ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npm run seed:support')
    console.error('  或')
    console.error('  npm run seed:support your@email.com yourpassword')
    throw error
  }
}

// 支援類別資料
const supportSections = [
  { title: '查詢熱線', iconType: 'phone', order: 1 },
  { title: '民政事務處', iconType: 'building', order: 2 },
  { title: '臨時庇護中心', iconType: 'shield', order: 3 },
  { title: '社區中心', iconType: 'users', order: 4 },
  { title: '教會', iconType: 'church', order: 5 },
  { title: '醫院援助站', iconType: 'hospital', order: 6 },
  { title: '寵物救援', iconType: 'heart', order: 7 },
  { title: '充電服務', iconType: 'battery', order: 8 },
  { title: '慈善基金支援', iconType: 'heart', order: 9 },
  { title: '情緒支援熱線', iconType: 'message', order: 10 },
]

// 支援項目資料（需要先創建 sections 後才能使用）
const supportItemsData = [
  // 查詢熱線
  {
    sectionTitle: '查詢熱線',
    name: '市民查詢大埔火災傷亡資訊',
    phone: '1878 999',
    note: '警察熱線',
    order: 1,
  },
  // 民政事務處
  {
    sectionTitle: '民政事務處',
    name: '大埔民政事務處',
    address: '雅麗氏何妙齡那打素醫院跨部門援助站',
    phone: '2658 4040',
    order: 1,
  },
  {
    sectionTitle: '民政事務處',
    name: '沙田民政事務處',
    address: '威爾斯親王醫院跨部門援助站',
    phone: '3505 1555',
    order: 2,
  },
  // 臨時庇護中心
  {
    sectionTitle: '臨時庇護中心',
    name: '東昌街社區會堂臨時庇護中心',
    address: '大埔東昌街25號體育館大樓1樓',
    phone: '2253 1637',
    order: 1,
  },
  {
    sectionTitle: '臨時庇護中心',
    name: '廣福社區會堂臨時庇護中心',
    address: '大埔廣福邨',
    phone: '2657 2948',
    order: 2,
  },
  // 社區中心
  {
    sectionTitle: '社區中心',
    name: '賽馬會大埔青少年綜合服務中心',
    address: '新界大埔廣福邨廣仁樓220-229室',
    phone: '2653 8514',
    order: 1,
  },
  {
    sectionTitle: '社區中心',
    name: '賽馬會太和中心',
    address: '太和邨福和樓11座',
    phone: '2654 6066',
    order: 2,
  },
  {
    sectionTitle: '社區中心',
    name: '香港傷健協會新界傷健中心',
    address: '大埔廣福邨廣平樓地下，廣望街110-115號',
    phone: '2638 9011',
    order: 3,
  },
  {
    sectionTitle: '社區中心',
    name: '中華基督教會馮梁結紀念中學',
    address: '大埔普門路22號',
    phone: '2651 6033',
    order: 4,
  },
  {
    sectionTitle: '社區中心',
    name: '救世軍大埔青少年綜合服務中心',
    address: '大埔大元邨泰民樓3樓301-316室',
    phone: '2667 2913',
    order: 5,
  },
  {
    sectionTitle: '社區中心',
    name: 'YMCA烏溪沙青年新村',
    address: '馬鞍山鞍駿街2號',
    phone: '2642 9420',
    contact: '廖小姐',
    order: 6,
  },
  // 教會
  {
    sectionTitle: '教會',
    name: '宣道會大埔堂',
    address: '大埔廣福路152-172號大埔商業中心13樓',
    phone: '9746 8710',
    contact: '趙牧師',
    order: 1,
  },
  {
    sectionTitle: '教會',
    name: '恩典中心教會',
    address: '大埔太和邨多層停車場地下',
    phone: '9443 3733',
    contact: '陳牧師',
    order: 2,
  },
  {
    sectionTitle: '教會',
    name: '大埔天主教會',
    address: '大埔運頭街10號聖母無原罪小堂',
    phone: '2652 2655',
    order: 3,
  },
  {
    sectionTitle: '教會',
    name: '香港華人基督教聯會麗和堂',
    address: '大埔翠和里5號麗和閣地下K舖，近聖公會禮拜堂',
    phone: '9263 6470',
    contact: '陳傳道',
    order: 4,
  },
  {
    sectionTitle: '教會',
    name: '禮賢會大埔金福堂',
    address: '大埔安富道2-8號金富樓2字樓（鐵路博物館旁）',
    phone: ['2665 1786', '9852 9901'],
    order: 5,
  },
  {
    sectionTitle: '教會',
    name: '禮賢會大埔堂',
    address: '大埔汀角路7號及禮堂3樓',
    phone: ['2665 1786', '9852 9901'],
    order: 6,
  },
  // 醫院援助站
  {
    sectionTitle: '醫院援助站',
    name: '雅麗氏何妙齡那打素醫院援助站',
    address: '大埔全安路11號',
    phone: '2658 4040',
    order: 1,
  },
  // 寵物救援
  {
    sectionTitle: '寵物救援',
    name: '香港寵物會寵物救援團隊救護車',
    address: '大埔宏福苑附近',
    phone: '5481 4646',
    order: 1,
  },
  // 充電服務
  {
    sectionTitle: '充電服務',
    name: 'CHARGESPOT',
    note: '即時起於大埔區提供160小時免費充電器租借，直至另行通知',
    order: 1,
  },
  {
    sectionTitle: '充電服務',
    name: 'CSL大埔門市緊急支援',
    address: '大埔超級城A區14-15號商店',
    note: '免費借出 ChargeSpot 行動電源 / 店內手機充電',
    order: 2,
  },
  // 慈善基金支援
  {
    sectionTitle: '慈善基金支援',
    name: '周大福慈善基金支援計劃',
    phone: '2772 2322',
    order: 1,
  },
  // 情緒支援熱線
  {
    sectionTitle: '情緒支援熱線',
    name: 'Open 噏',
    phone: ['WhatsApp / SMS: 9101 2012'],
    order: 1,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '社會福利署熱線',
    phone: '2343 2255',
    order: 2,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '香港撒瑪利亞防止自殺會',
    phone: '2389 2222',
    order: 3,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '撒瑪利亞會（多種語言）',
    phone: '2896 0000',
    order: 4,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '生命熱線',
    phone: '2382 0000',
    order: 5,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '明愛向晴熱線',
    phone: '18288',
    order: 6,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '醫院管理局精神健康專線',
    phone: '2466 7350',
    order: 7,
  },
  {
    sectionTitle: '情緒支援熱線',
    name: '利民會「即時通」',
    phone: '3512 2626',
    order: 8,
  },
]

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

async function seedSupportInfo() {
  try {
    // 先進行認證
    await authenticate()
    
    console.log('開始匯入支援資訊數據...')

    // 檢查是否要清空現有數據（可通過環境變數 CLEAR_DATA=true 來啟用）
    const shouldClear = process.env.CLEAR_DATA === 'true'
    if (shouldClear) {
      console.log('⚠️  清空現有數據...')
      await clearCollection('supportItems')
      await clearCollection('supportSections')
    }

    // 先創建或更新 sections
    console.log('創建/更新支援類別...')
    const sectionMap: Record<string, string> = {}
    
    // 先查詢現有的 sections
    const existingSectionsSnapshot = await getDocs(collection(db, 'supportSections'))
    const existingSectionsMap: Record<string, string> = {}
    existingSectionsSnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.title) {
        existingSectionsMap[data.title] = doc.id
      }
    })
    
    for (const section of supportSections) {
      if (existingSectionsMap[section.title]) {
        // 如果已存在，使用現有的 ID
        sectionMap[section.title] = existingSectionsMap[section.title]
        console.log(`  ⊙ 類別已存在: ${section.title}`)
      } else {
        // 如果不存在，創建新的
        const docRef = await addDoc(collection(db, 'supportSections'), {
          ...section,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
        sectionMap[section.title] = docRef.id
        console.log(`  ✓ 已創建類別: ${section.title}`)
      }
    }

    // 然後創建 items
    console.log('創建/更新支援項目...')
    
    // 查詢現有的 items
    const existingItemsSnapshot = await getDocs(collection(db, 'supportItems'))
    const existingItemsMap: Record<string, string> = {}
    existingItemsSnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.name && data.sectionId) {
        // 使用 name + sectionId 作為唯一標識
        const key = `${data.sectionId}_${data.name}`
        existingItemsMap[key] = doc.id
      }
    })
    
    let createdCount = 0
    let skippedCount = 0
    
    for (const item of supportItemsData) {
      const sectionId = sectionMap[item.sectionTitle]
      if (!sectionId) {
        console.error(`  ✗ 找不到類別: ${item.sectionTitle}`)
        continue
      }

      const itemKey = `${sectionId}_${item.name}`
      if (existingItemsMap[itemKey] && !shouldClear) {
        // 如果已存在且不清空數據，跳過
        console.log(`  ⊙ 項目已存在: ${item.name}`)
        skippedCount++
        continue
      }

      // 構建文檔數據，只包含存在的欄位
      const itemData: any = {
        name: item.name,
        sectionId,
        order: item.order,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      
      // 只在值存在時添加可選欄位
      if (item.address) {
        itemData.address = item.address
      }
      if (item.phone) {
        itemData.phone = item.phone
      }
      if (item.contact) {
        itemData.contact = item.contact
      }
      if (item.note) {
        itemData.note = item.note
      }
      
      await addDoc(collection(db, 'supportItems'), itemData)
      console.log(`  ✓ 已創建項目: ${item.name}`)
      createdCount++
    }

    console.log('\n✅ 支援資訊數據匯入完成！')
    console.log(`- 支援類別: ${supportSections.length} 個`)
    console.log(`- 新增項目: ${createdCount} 個`)
    if (skippedCount > 0) {
      console.log(`- 跳過項目（已存在）: ${skippedCount} 個`)
    }
    console.log(`\n💡 提示：如需清空現有數據後重新匯入，請運行: CLEAR_DATA=true npm run seed:support`)
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
seedSupportInfo()
  .then(() => {
    console.log('Seeding complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })

