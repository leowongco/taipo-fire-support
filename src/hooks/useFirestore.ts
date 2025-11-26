import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Announcement, Resource, SupportSection, SupportItem } from '../types'

type CollectionType = 'announcements' | 'resources' | 'supportSections' | 'supportItems'

type FirestoreType = Announcement | Resource | SupportSection | SupportItem

export function useFirestore<T extends FirestoreType>(
  collectionName: CollectionType
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const collectionRef = collection(db, collectionName)
    // 根據集合類型選擇排序欄位
    let orderField = 'updatedAt'
    if (collectionName === 'announcements') {
      orderField = 'timestamp'
    } else if (collectionName === 'supportSections' || collectionName === 'supportItems') {
      orderField = 'order'
    }
    const q = query(collectionRef, orderBy(orderField, collectionName === 'announcements' ? 'desc' : 'asc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[]
        setData(items)
        setLoading(false)
        setError(null)
      },
      (err: any) => {
        console.error(`Firestore 錯誤 (${collectionName}):`, err)
        
        // 提供更詳細的錯誤信息
        if (err?.code === 'permission-denied') {
          console.error('⚠️ 權限錯誤：請檢查 Firestore 安全規則是否已部署')
        } else if (err?.code === 'unavailable') {
          console.error('⚠️ Firestore 不可用：請確認 Firestore 數據庫已啟用')
        } else if (err?.message?.includes('CONFIGURATION_NOT_FOUND')) {
          console.error('⚠️ 配置未找到：請確認 Firebase 項目設置正確')
        }
        
        setError(err as Error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [collectionName])

  return { data, loading, error }
}

