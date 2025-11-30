import { Timestamp } from 'firebase/firestore'

// 公告（管理員手動添加）
export interface Announcement {
  id: string
  title: string
  content: string
  source: string
  url?: string
  timestamp: Timestamp
}

// 新聞（自動抓取）
export interface News {
  id: string
  title: string
  content: string
  source: string
  url?: string
  tag?: 'gov' | 'news' // 政府新聞、新聞
  newsCategory?: 'event-update' | 'financial-support' | 'emotional-support' | 'accommodation' | 'medical-legal' | 'reconstruction' | 'statistics' | 'community-support' | 'government-announcement' | 'investigation' | 'general-news' // AI 分類的新聞類別
  timestamp: Timestamp
}

// 集中式地址簿 - 用於填充下拉選單
export interface Location {
  id: string
  name: string      // e.g., "Tai Po Community Centre"
  address: string   // Full address
  type: 'shelter' | 'collection_point'
}

// 事件統計數據
export interface EventStats {
  id: string
  eventStartDate: Timestamp
  casualties: number // 死亡人數
  injured: number // 受傷人數
  missing: number // 失蹤人數
  lastUpdated: Timestamp
  source: string // 數據來源
  verifiedSources?: string[] // 已驗證的來源列表
  pendingUpdates?: {
    casualties?: { value: number; sources: string[] }
    injured?: { value: number; sources: string[] }
    missing?: { value: number; sources: string[] }
  } // 待驗證的更新（需要多個來源確認）
}

// 重建資訊
export interface ReconstructionInfo {
  id: string
  title: string
  content: string
  category: 'progress' | 'timeline' | 'resources' | 'updates' // 重建進度、時間表、資源資訊、最新更新
  status: 'active' | 'completed' | 'pending'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  timestamp: Timestamp
  url?: string
  source: string
}

// 歷史記錄
export interface HistoryRecord {
  id: string
  title: string
  content: string
  date: Timestamp
  category: 'milestone' | 'news' | 'summary' // 重要里程碑、新聞摘要、經驗總結
  tags: string[]
  importance: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Timestamp
}

// 經濟援助
export interface FinancialAid {
  id: string
  provider: string
  title: string
  amount: string
  location?: string | string[] // 支持多個地址
  contact?: string | string[] // 支持多個聯絡方式
  time?: string
  requirement?: string
  type: 'cash' | 'goods' | 'voucher'
  status: 'open' | 'closed' | 'limited'
  targetGroup?: 'affected-families' | 'general-residents' // 受影響家庭（特別支援）| 一般受影響居民
  sourceRef?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// 特別服務（醫療、寵物、情緒支援等）
export interface Service {
  id: string
  category: 'medical' | 'pets' | 'emotional' | 'funeral' | 'accommodation'
  name: string
  service: string
  target?: string
  location?: string
  contact?: string
  validUntil?: string
  note?: string
  sourceRef?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// 支援服務（統一格式，包含所有類型的支援服務）
export interface ReliefService {
  id: string
  category: 'emotional' | 'childcare' | 'education' | 'accommodation' | 'medical' | 'legal' | 'funeral' | 'pets'
  name: string
  provider: string
  description: string
  contact: string | string[] // 支持多個聯絡方式（電話、IG、Email等）
  location: string | string[] // 支持多個地址
  openingHours?: string
  note?: string
  source_ref?: string
  status?: string
  order?: number // 用於排序
  createdAt: Timestamp
  updatedAt: Timestamp
}

