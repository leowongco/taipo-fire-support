import { Timestamp } from 'firebase/firestore'

export interface Announcement {
  id: string
  title: string
  content: string
  source: string
  url?: string
  isUrgent: boolean
  tag?: 'urgent' | 'gov' | 'news' // 緊急、政府新聞、新聞
  timestamp: Timestamp
}

export interface Resource {
  id: string
  locationName: string
  address: string
  mapLink: string
  status: 'open' | 'closed' | 'full'
  category: 'supply' | 'shelter' // 'supply' = 物資收集站, 'shelter' = 庇護中心
  needs: string[]
  contact: string
  updatedAt: Timestamp
}

export interface SupportItem {
  id: string
  name: string
  address?: string
  phone?: string | string[]
  contact?: string
  note?: string
  sectionId: string // 所屬的 section ID
  order: number // 排序順序
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SupportSection {
  id: string
  title: string
  iconType: 'phone' | 'building' | 'shield' | 'users' | 'church' | 'hospital' | 'heart' | 'battery' | 'message'
  order: number // 排序順序
  createdAt: Timestamp
  updatedAt: Timestamp
}

