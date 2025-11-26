import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// 驗證環境變量
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 檢查缺失的環境變量
const envVarMap: Record<string, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => envVarMap[key])

if (missingVars.length > 0) {
  const errorMessage = `❌ Firebase 配置錯誤：缺少以下環境變量：\n${missingVars.join('\n')}\n\n請確保項目根目錄有 .env 文件並包含所有必需的 Firebase 配置。`
  console.error(errorMessage)
  
  // 在開發環境中顯示更詳細的錯誤
  if (import.meta.env.DEV) {
    throw new Error(errorMessage)
  }
}

const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey!,
  authDomain: requiredEnvVars.authDomain!,
  projectId: requiredEnvVars.projectId!,
  storageBucket: requiredEnvVars.storageBucket!,
  messagingSenderId: requiredEnvVars.messagingSenderId!,
  appId: requiredEnvVars.appId!,
}

// 驗證配置格式
if (!firebaseConfig.projectId || firebaseConfig.projectId.trim() === '') {
  throw new Error('Firebase projectId 不能為空。請檢查 .env 文件中的 VITE_FIREBASE_PROJECT_ID')
}

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.trim() === '') {
  throw new Error('Firebase apiKey 不能為空。請檢查 .env 文件中的 VITE_FIREBASE_API_KEY')
}

// 初始化 Firebase
let app
try {
  app = initializeApp(firebaseConfig)
  
  // 在開發環境中顯示配置信息
  if (import.meta.env.DEV) {
    console.log('✅ Firebase 初始化成功')
    console.log(`📋 項目 ID: ${firebaseConfig.projectId}`)
  }
} catch (error: any) {
  console.error('❌ Firebase 初始化失敗:', error.message)
  throw new Error(`Firebase 初始化錯誤: ${error.message}\n\n請檢查：\n1. .env 文件是否存在\n2. 所有 Firebase 配置變量是否正確\n3. Firebase 項目是否已正確設置`)
}

export const db = getFirestore(app)
export const auth = getAuth(app)

