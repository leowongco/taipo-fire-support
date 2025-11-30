/**
 * 添加電費問題相關資訊
 * 使用方式：npm run add:electricity-info
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

async function addElectricityInfo() {
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

    // 檢查是否已存在"公共服務"或"電費"類別
    const sectionsSnapshot = await getDocs(collection(db, 'supportSections'))
    let electricitySection = sectionsSnapshot.docs.find(
      doc => doc.data().title === '公共服務' || doc.data().title === '電費問題'
    )

    // 如果不存在，創建新的 section
    if (!electricitySection) {
      console.log('📝 正在創建「公共服務」類別...')
      const sectionsSnapshot = await getDocs(collection(db, 'supportSections'))
      const maxOrder = sectionsSnapshot.docs.reduce((max, doc) => {
        const order = doc.data().order || 0
        return Math.max(max, order)
      }, 0)

      const newSectionRef = await addDoc(collection(db, 'supportSections'), {
        title: '公共服務',
        iconType: 'battery', // 使用 battery 圖標代表電力服務
        order: maxOrder + 1,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      
      electricitySection = { id: newSectionRef.id, data: () => ({ title: '公共服務' }) } as any
      console.log(`✅ 已創建「公共服務」類別 (ID: ${newSectionRef.id})\n`)
    } else {
      console.log(`✅ 找到現有類別「${electricitySection.data().title}」\n`)
    }

    if (!electricitySection) {
      throw new Error('無法創建或找到公共服務類別')
    }

    const sectionId = electricitySection.id

    // 檢查是否已存在電費資訊
    const itemsSnapshot = await getDocs(collection(db, 'supportItems'))
    const sectionItems = itemsSnapshot.docs.filter((doc: any) => doc.data().sectionId === sectionId)
    const existingItem = sectionItems.find(
      (doc: any) => doc.data().name.includes('電費') || doc.data().name.includes('中電')
    )

    if (existingItem) {
      console.log('⏭️  電費資訊已存在，跳過添加')
      console.log(`   現有項目：${existingItem.data().name}`)
      process.exit(0)
    }

    // 獲取該 section 的最大 order
    const sectionItemOrders = sectionItems.map((doc: any) => doc.data().order || 0)
    const maxOrder = sectionItemOrders.length > 0 ? Math.max(...sectionItemOrders) : 0

    // 添加電費資訊
    console.log('📝 正在添加電費問題資訊...')
    const electricityInfo = {
      sectionId: sectionId,
      name: '中電電費問題',
      phone: '2629-8896',
      note: `• 未交到電費唔使擔心，已安排豁免
• 自動轉賬不會過數
• 舊帳戶自動終止（只適用於1至7座）
• 稍後安排退回按金
• 服務時間：08:00 – 20:00`,
      order: maxOrder + 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }

    await addDoc(collection(db, 'supportItems'), electricityInfo)
    console.log('✅ 已添加電費問題資訊')
    console.log('   項目名稱：中電電費問題')
    console.log('   電話：2629-8896')
    console.log('   服務時間：08:00 – 20:00')

    console.log('\n✅ 完成！')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ 添加失敗:', error.message)
    if (error.code === 'permission-denied') {
      console.error('⚠️  權限錯誤：請確保已部署最新的 Firestore 安全規則')
    }
    process.exit(1)
  }
}

addElectricityInfo()

