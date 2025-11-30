/**
 * 種子數據：救災援助資料
 * 從救災小冊子提取的詳細資料
 * 使用方式：npm run seed:relief-data
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, Timestamp } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import dotenv from 'dotenv'
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

// 經濟援助數據
const financialAidData = [
  {
    provider: "政府 (社會福利署)",
    title: "大埔宏福苑援助基金",
    amount: "HK$10,000 (每戶)",
    location: "大埔社區中心 / 馮梁結紀念中學 / 其他庇護中心",
    requirement: "身分證",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 146, 147]"
  },
  {
    provider: "公益金",
    title: "及時雨大埔火災援助基金",
    amount: "HK$20,000 (每戶現金票)",
    location: "馮梁結紀念中學 或 致電社福機構預約",
    contact: "2599 6111",
    requirement: "身分證、住址證明",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 132, 133]"
  },
  {
    provider: "港鐵 (MTR)",
    title: "八達通資助",
    amount: "HK$2,000 (已增值八達通)",
    location: "大埔墟火車站",
    contact: "2651 6323",
    time: "07:00 - 23:00",
    requirement: "姓名、電話、住址",
    type: "goods",
    status: "open",
    sourceRef: "[cite: 92, 93, 94]"
  },
  {
    provider: "工聯會",
    title: "關愛宏福苑應急錢",
    amount: "HK$2,000 (每戶)",
    location: "大埔廣福道70-78號寶康大廈一樓",
    contact: "2651 6323",
    time: "10:00 - 13:00",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 44, 45, 47]"
  },
  {
    provider: "大航假期",
    title: "緊急支援津貼",
    amount: "HK$2,000 (每戶)",
    location: "寶湖花園商場二樓211A鋪",
    contact: "6083 7515",
    requirement: "災民證或住址證明",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 33, 34, 35]"
  },
  {
    provider: "東華三院 / 保良局 / 家福會",
    title: "社福界應急錢",
    amount: "各 HK$1,000 (共可申請多項)",
    location: "中華基督教會馮梁結紀念中學",
    contact: "東華: 18281 / 保良局: 2277 8333 / 家福會: 2772 2322",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 58, 68, 82]"
  },
  {
    provider: "仁愛堂",
    title: "仁間有愛應急錢",
    amount: "HK$1,000 - $20,000",
    location: "仁愛堂賽馬會田家炳綜合青少年服務中心",
    contact: "2654 6188",
    type: "cash",
    status: "open",
    sourceRef: "[cite: 118, 119, 122]"
  }
]

// 特別服務數據
const servicesData = [
  {
    category: "medical",
    name: "元朗醫館",
    service: "中醫/針灸/推拿 (免費)",
    target: "宏福苑居民及救援人員",
    location: "元朗宏業南街12-18號新順福中心3樓8室",
    contact: "6316 5880",
    validUntil: "2025-12-12",
    sourceRef: "[cite: 412, 416, 422]"
  },
  {
    category: "pets",
    name: "城大醫療動物中心",
    service: "貓狗醫療協助 (豁免診金)",
    location: "深水埗醫局街202號",
    contact: "3650 3200",
    sourceRef: "[cite: 469, 472, 474]"
  },
  {
    category: "pets",
    name: "N24社區動物醫院",
    service: "24小時醫療、免費診金X光、借用氧氣",
    location: "洪水橋德興樓地下",
    contact: "2956 5999 / 9790 5359",
    sourceRef: "[cite: 497, 500, 505]"
  },
  {
    category: "pets",
    name: "NPV 動物流動獸醫診所",
    service: "緊急醫療 (費用全免)",
    location: "大埔運頭街10號聖母無玷之心堂",
    contact: "5931 9764",
    note: "優先預留急症位置",
    sourceRef: "[cite: 483, 487, 495]"
  },
  {
    category: "emotional",
    name: "紅十字會 / 社會福利署",
    service: "24小時情緒支援熱線",
    contact: "2343 2255 (社署) / 18288 (明愛)",
    sourceRef: "[cite: 723]"
  },
  {
    category: "funeral",
    name: "東華三院殯儀基金",
    service: "免費殯儀服務 (上限8萬)",
    contact: "2657 7899",
    note: "必須委託其屬下殯儀館",
    sourceRef: "[cite: 710, 714]"
  }
]

// 更新庇護中心數據
const shelterUpdates = [
  {
    name: "中華基督教會馮梁結紀念中學",
    type: "shelter",
    status: "open",
    address: "大埔區 (主要辦理援助金地點)",
    services: ["災民證申請", "現金援助辦理", "臨時住宿"],
    sourceRef: "[cite: 145]"
  },
  {
    name: "綠匯學苑 (舊大埔警署)",
    type: "hostel",
    status: "limited",
    address: "大埔運頭角里11號",
    capacity: "12床位",
    contact: "9883 4760 / 2996 2800",
    note: "有賓館房間，洗手間共用",
    sourceRef: "[cite: 343, 345, 346]"
  },
  {
    name: "善導會 (大埔善樓)",
    type: "transitional",
    status: "open",
    address: "大埔船灣陳屋168號",
    contact: "4645 2763",
    note: "已協調直接接收受影響居民",
    sourceRef: "[cite: 840, 842, 847]"
  },
  {
    name: "策誠軒 (房協)",
    type: "transitional",
    status: "application_required",
    address: "大埔公路4105號",
    contact: "2331 3110",
    note: "需先聯絡登記，再填表入住",
    sourceRef: "[cite: 849, 852]"
  },
  {
    name: "烏溪沙青年新村 (YMCA)",
    type: "camp",
    status: "open",
    address: "馬鞍山鞍駿街2號",
    contact: "2642 9420 (廖小姐)",
    note: "提供約500個臨時床位，至12月3日",
    sourceRef: "[cite: 1009, 1011, 1013]"
  },
  {
    name: "保良局 北潭涌/大棠渡假營",
    type: "camp",
    status: "open",
    contact: "北潭涌: 2792 4302 / 大棠: 2478 1332",
    note: "短期住宿至12月3日，各約120宿位",
    sourceRef: "[cite: 401, 406]"
  }
]

async function seedReliefData() {
  try {
    // 登入管理員帳號
    const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      console.error('❌ 請設置 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變量')
      process.exit(1)
    }

    console.log('🔐 正在登入管理員帳號...')
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    console.log('✅ 登入成功\n')

    // 1. 種子經濟援助數據
    console.log('📊 正在種子經濟援助數據...')
    const existingAid = await getDocs(collection(db, 'financialAid'))
    const existingAidTitles = new Set(existingAid.docs.map(doc => doc.data().title))
    
    let aidAdded = 0
    for (const aid of financialAidData) {
      if (existingAidTitles.has(aid.title)) {
        console.log(`⏭️  跳過已存在的援助: ${aid.title}`)
        continue
      }
      try {
        await addDoc(collection(db, 'financialAid'), {
          ...aid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
        console.log(`✅ 已添加: ${aid.title}`)
        aidAdded++
        // 添加小延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        console.error(`❌ 添加失敗 (${aid.title}):`, error.message)
        if (error.code === 'permission-denied') {
          console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
        }
      }
    }
    console.log(`✅ 經濟援助數據完成: 新增 ${aidAdded} 條\n`)

    // 2. 種子特別服務數據
    console.log('📊 正在種子特別服務數據...')
    const existingServices = await getDocs(collection(db, 'services'))
    const existingServiceNames = new Set(existingServices.docs.map(doc => doc.data().name))
    
    let servicesAdded = 0
    for (const service of servicesData) {
      if (existingServiceNames.has(service.name)) {
        console.log(`⏭️  跳過已存在的服務: ${service.name}`)
        continue
      }
      try {
        await addDoc(collection(db, 'services'), {
          ...service,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
        console.log(`✅ 已添加: ${service.name} (${service.category})`)
        servicesAdded++
        // 添加小延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        console.error(`❌ 添加失敗 (${service.name}):`, error.message)
        if (error.code === 'permission-denied') {
          console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
        }
      }
    }
    console.log(`✅ 特別服務數據完成: 新增 ${servicesAdded} 條\n`)

    // 3. 更新庇護中心數據
    console.log('📊 正在更新庇護中心數據...')
    const existingLocations = await getDocs(collection(db, 'locations'))
    const existingLocationNames = new Set(existingLocations.docs.map(doc => doc.data().name))
    
    let locationsAdded = 0
    for (const shelter of shelterUpdates) {
      if (existingLocationNames.has(shelter.name)) {
        console.log(`⏭️  跳過已存在的位置: ${shelter.name}`)
        continue
      }
      try {
        await addDoc(collection(db, 'locations'), {
          ...shelter,
          name: shelter.name,
          address: shelter.address || '',
          type: shelter.type === 'shelter' ? 'shelter' : 'collection_point',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
        console.log(`✅ 已添加: ${shelter.name}`)
        locationsAdded++
        // 添加小延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        console.error(`❌ 添加失敗 (${shelter.name}):`, error.message)
        if (error.code === 'permission-denied') {
          console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
        }
      }
    }
    console.log(`✅ 庇護中心數據完成: 新增 ${locationsAdded} 條\n`)

    console.log('✅ 所有數據種子完成！')
    console.log(`   經濟援助: ${aidAdded} 條`)
    console.log(`   特別服務: ${servicesAdded} 條`)
    console.log(`   庇護中心: ${locationsAdded} 條`)

    process.exit(0)
  } catch (error: any) {
    console.error('❌ 種子數據失敗:', error.message)
    process.exit(1)
  }
}

seedReliefData()

