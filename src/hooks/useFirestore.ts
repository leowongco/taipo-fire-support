import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, onSnapshot, getDocs, limit as firestoreLimit } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Announcement, News, Location, EventStats, ReconstructionInfo, HistoryRecord, FinancialAid, Service, ReliefService } from '../types'

type CollectionType = 'announcements' | 'news' | 'locations' | 'eventStats' | 'reconstructionInfo' | 'historyRecords' | 'financialAid' | 'services' | 'reliefServices'

type FirestoreType = Announcement | News | Location | EventStats | ReconstructionInfo | HistoryRecord | FinancialAid | Service | ReliefService

interface UseFirestoreOptions {
  /**
   * 查詢結果數量限制（建議設置以減少讀取操作）
   * 預設值根據集合類型自動設置
   */
  limit?: number
  /**
   * 是否使用實時監聽（onSnapshot）
   * false = 使用一次性查詢（getDocs），減少讀取操作
   * true = 使用實時監聽（預設，適合需要實時更新的場景）
   * 
   * 建議：
   * - 一般頁面：使用 false（一次性查詢）
   * - 管理後台：使用 true（實時監聽）
   */
  realtime?: boolean
}

export function useFirestore<T extends FirestoreType>(
  collectionName: CollectionType,
  options: UseFirestoreOptions = {}
) {
  const { limit: customLimit, realtime = false } = options
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 根據集合類型獲取預設限制
  const getDefaultLimit = useCallback((name: CollectionType): number => {
    // 根據集合類型設置合理的預設限制
    switch (name) {
      case 'news':
      case 'announcements':
        return 100 // 新聞和公告通常只需要最新 100 條
      case 'historyRecords':
        return 50 // 歷史記錄通常只需要最新 50 條
      case 'locations':
      case 'services':
      case 'reliefServices':
        return 500 // 這些集合通常數據量較小，但設置上限以防萬一
      case 'eventStats':
        return 10 // 事件統計通常只有幾條
      case 'reconstructionInfo':
        return 50
      case 'financialAid':
        return 100
      default:
        return 100
    }
  }, [])

  // 獲取查詢配置
  const getQueryConfig = useCallback(() => {
    const collectionRef = collection(db, collectionName)
    // 根據集合類型選擇排序欄位
    let orderField = 'updatedAt'
    let orderDirection: 'asc' | 'desc' = 'desc'
    
    if (collectionName === 'announcements') {
      orderField = 'timestamp'
      orderDirection = 'desc'
    } else if (collectionName === 'news') {
      orderField = 'timestamp'
      orderDirection = 'desc'
    } else if (collectionName === 'locations') {
      orderField = 'name'
      orderDirection = 'asc'
    } else if (collectionName === 'eventStats') {
      orderField = 'lastUpdated'
      orderDirection = 'desc'
    } else if (collectionName === 'reconstructionInfo') {
      orderField = 'timestamp'
      orderDirection = 'desc'
    } else if (collectionName === 'historyRecords') {
      orderField = 'date'
      orderDirection = 'desc'
    } else if (collectionName === 'financialAid') {
      orderField = 'createdAt'
      orderDirection = 'desc'
    } else if (collectionName === 'services') {
      orderField = 'category'
      orderDirection = 'asc'
    } else if (collectionName === 'reliefServices') {
      orderField = 'order'
      orderDirection = 'asc'
    }
    
    const queryLimit = customLimit ?? getDefaultLimit(collectionName)
    const baseQuery = query(collectionRef, orderBy(orderField, orderDirection))
    
    // 添加限制（如果設置了）
    const finalQuery = queryLimit > 0 
      ? query(baseQuery, firestoreLimit(queryLimit))
      : baseQuery
    
    return finalQuery
  }, [collectionName, customLimit, getDefaultLimit])

  // 一次性查詢函數
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const q = getQueryConfig()
      const snapshot = await getDocs(q)
      
      const items = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          ...data,
          id: doc.id,
          firestoreId: doc.id,
        } as unknown as T
      })
      
      setData(items)
      setLoading(false)
    } catch (err: any) {
      console.error(`Firestore 錯誤 (${collectionName}):`, err)
      setError(err as Error)
      setLoading(false)
    }
  }, [collectionName, getQueryConfig])

  // 實時監聽或一次性查詢
  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    if (realtime) {
      // 使用實時監聽
      const q = getQueryConfig()
      
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return
          
          const items = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              ...data,
              id: doc.id,
              firestoreId: doc.id,
            } as unknown as T
          })
          setData(items)
          setLoading(false)
          setError(null)
        },
        (err: any) => {
          if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
            return
          }
          
          if (!isMounted) return
          
          console.error(`Firestore 錯誤 (${collectionName}):`, err)
          
          if (err?.code === 'permission-denied') {
            if (err?.message?.includes('index') || err?.message?.includes('indexes')) {
              console.error('⚠️ 索引錯誤：需要創建 Firestore 索引')
              console.error('   請訪問 Firebase Console 中的索引頁面，點擊錯誤訊息中的鏈接創建索引')
            } else {
              console.error('⚠️ 權限錯誤：請檢查 Firestore 安全規則是否已部署')
            }
          } else if (err?.code === 'unavailable') {
            console.error('⚠️ Firestore 不可用：請確認 Firestore 數據庫已啟用')
          } else if (err?.message?.includes('CONFIGURATION_NOT_FOUND')) {
            console.error('⚠️ 配置未找到：請確認 Firebase 項目設置正確')
          } else if (err?.message?.includes('index')) {
            console.error('⚠️ 索引錯誤：需要創建 Firestore 索引')
          }
          
          setError(err as Error)
          setLoading(false)
        }
      )
    } else {
      // 使用一次性查詢
      fetchData()
    }

    return () => {
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [collectionName, realtime, fetchData, getQueryConfig])

  // 手動刷新函數（僅在非實時模式下有用）
  const refresh = useCallback(() => {
    if (!realtime) {
      fetchData()
    }
  }, [realtime, fetchData])

  return { data, loading, error, refresh }
}

