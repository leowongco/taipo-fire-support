import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'financial_aid_checklist'

interface ChecklistItem {
  id: string
  appliedAt: number // timestamp
}

/**
 * 管理經濟援助申請清單的 Hook
 * 使用 localStorage 存儲用戶的申請記錄
 */
export function useFinancialAidChecklist() {
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  // 從 localStorage 載入已申請的 ID
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items: ChecklistItem[] = JSON.parse(stored)
        setAppliedIds(new Set(items.map(item => item.id)))
      }
    } catch (error) {
      console.error('載入申請清單失敗:', error)
    }
  }, [])

  // 標記為已申請
  const markAsApplied = useCallback((id: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const items: ChecklistItem[] = stored ? JSON.parse(stored) : []
      
      // 檢查是否已經存在
      if (!items.find(item => item.id === id)) {
        items.push({
          id,
          appliedAt: Date.now(),
        })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
        setAppliedIds(new Set(items.map(item => item.id)))
      }
    } catch (error) {
      console.error('保存申請記錄失敗:', error)
    }
  }, [])

  // 取消標記（標記為未申請）
  const markAsNotApplied = useCallback((id: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items: ChecklistItem[] = JSON.parse(stored)
        const filtered = items.filter(item => item.id !== id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        setAppliedIds(new Set(filtered.map(item => item.id)))
      }
    } catch (error) {
      console.error('刪除申請記錄失敗:', error)
    }
  }, [])

  // 切換申請狀態
  const toggleApplied = useCallback((id: string) => {
    if (appliedIds.has(id)) {
      markAsNotApplied(id)
    } else {
      markAsApplied(id)
    }
  }, [appliedIds, markAsApplied, markAsNotApplied])

  // 檢查是否已申請
  const isApplied = useCallback((id: string) => {
    return appliedIds.has(id)
  }, [appliedIds])

  // 獲取申請時間
  const getAppliedAt = useCallback((id: string): number | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const items: ChecklistItem[] = JSON.parse(stored)
        const item = items.find(item => item.id === id)
        return item ? item.appliedAt : null
      }
    } catch (error) {
      console.error('獲取申請時間失敗:', error)
    }
    return null
  }, [])

  // 清除所有記錄
  const clearAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setAppliedIds(new Set())
    } catch (error) {
      console.error('清除申請清單失敗:', error)
    }
  }, [])

  // 獲取所有已申請的項目
  const getAllApplied = useCallback((): ChecklistItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('獲取申請清單失敗:', error)
      return []
    }
  }, [])

  return {
    isApplied,
    toggleApplied,
    markAsApplied,
    markAsNotApplied,
    getAppliedAt,
    clearAll,
    getAllApplied,
    appliedCount: appliedIds.size,
  }
}

