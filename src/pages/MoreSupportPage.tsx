import { useState, useMemo, useEffect, useRef } from 'react'
import Layout from '../components/layout/Layout'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { ReliefService } from '../types'
import { Heart, Baby, GraduationCap, Home, Stethoscope, Scale, Flower2, Search, Clock, Dog } from 'lucide-react'
import { trackSearch, trackCategoryFilter, trackServiceView } from '../utils/analytics'
import { renderContact } from '../utils/renderContact'
import { renderLocation } from '../utils/renderLocation'

type CategoryFilter = 'all' | 'emotional' | 'childcare' | 'education' | 'accommodation' | 'medical-legal' | 'funeral' | 'pets'

export default function MoreSupportPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Firestore 數據 - 只獲取支援服務
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: reliefServices, loading: reliefServicesLoading } = useFirestore<ReliefService>('reliefServices', {
    realtime: false,
    limit: 500
  })
  
  const loading = reliefServicesLoading

  const getCategoryLabel = (category: ReliefService['category']) => {
    switch (category) {
      case 'emotional': return '情緒支援'
      case 'childcare': return '託兒'
      case 'education': return '學業'
      case 'accommodation': return '住宿'
      case 'medical': return '醫療'
      case 'legal': return '法律'
      case 'funeral': return '殯儀'
      case 'pets': return '寵物'
      default: return category
    }
  }

  const getCategoryIcon = (category: ReliefService['category']) => {
    switch (category) {
      case 'emotional': return Heart
      case 'childcare': return Baby
      case 'education': return GraduationCap
      case 'accommodation': return Home
      case 'medical': return Stethoscope
      case 'legal': return Scale
      case 'funeral': return Flower2
      case 'pets': return Dog
      default: return Heart
    }
  }

  const getCategoryColor = (category: ReliefService['category']) => {
    switch (category) {
      case 'emotional': return 'bg-pink-100 text-pink-800 border-pink-300'
      case 'childcare': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'education': return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'accommodation': return 'bg-green-100 text-green-800 border-green-300'
      case 'medical': return 'bg-red-100 text-red-800 border-red-300'
      case 'legal': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'funeral': return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'pets': return 'bg-indigo-100 text-indigo-800 border-indigo-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  // 過濾 ReliefServices 數據
  const filteredReliefServices = useMemo(() => {
    return reliefServices.filter((item) => {
      // 1. 先檢查分類過濾
      if (categoryFilter !== 'all') {
        // 處理 'medical-legal' 特殊情況
        if (categoryFilter === 'medical-legal') {
          if (item.category !== 'medical' && item.category !== 'legal') {
            return false
          }
        } 
        // 處理其他單一分類
        else {
          if (item.category !== categoryFilter) {
            return false
          }
        }
      }

      // 2. 再檢查搜索過濾（支持數組格式的 location 和 contact）
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const locationStr = Array.isArray(item.location) 
          ? item.location.join(' ') 
          : (typeof item.location === 'string' ? item.location : '')
        const contactStr = Array.isArray(item.contact) 
          ? item.contact.join(' ') 
          : (typeof item.contact === 'string' ? item.contact : '')
        
        const matchesSearch = (
          item.name.toLowerCase().includes(query) ||
          item.provider.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          locationStr.toLowerCase().includes(query) ||
          contactStr.toLowerCase().includes(query)
        )
        
        if (!matchesSearch) {
          return false
        }
      }

      // 通過所有過濾條件
      return true
    })
  }, [reliefServices, categoryFilter, searchQuery])

  // 使用防抖追蹤搜索
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        trackSearch(searchQuery, categoryFilter)
      }, 1000) // 1秒後追蹤
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, categoryFilter])

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">支援服務</h1>
        <p className="text-gray-600 text-sm">整合各類支援服務，包括情緒支援、託兒/學業、住宿、醫療/法律、殯儀、寵物等</p>
      </div>

      {/* 搜索欄 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索服務名稱、提供機構或描述..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              // 追蹤搜索（使用防抖，避免過多事件）
              if (e.target.value.trim()) {
                const timeoutId = setTimeout(() => {
                  trackSearch(e.target.value, categoryFilter)
                }, 500)
                return () => clearTimeout(timeoutId)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                trackSearch(searchQuery, categoryFilter)
              }
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>
      </div>

      {/* 分類標籤 */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">服務類別：</p>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'emotional', 'childcare', 'education', 'accommodation', 'medical-legal', 'funeral', 'pets'] as CategoryFilter[]).map((category) => {
            let Icon = Search
            let label = '全部'
            
            if (category === 'all') {
              Icon = Search
              label = '全部'
            } else if (category === 'medical-legal') {
              Icon = Stethoscope
              label = '醫療/法律'
            } else {
              Icon = getCategoryIcon(category as ReliefService['category'])
              label = getCategoryLabel(category as ReliefService['category'])
            }
            
            return (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setCategoryFilter(category)
                  trackCategoryFilter(category, 'more-support')
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  categoryFilter === category
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : (
        <>
          {/* ReliefServices 數據（支援服務） */}
          <div className="mb-8">
            {filteredReliefServices.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>找不到相關服務</p>
                <p className="text-sm mt-2">請嘗試其他搜索關鍵詞或選擇不同的分類</p>
              </div>
            ) : (
                <div className="space-y-4">
                  {filteredReliefServices.map((item, index) => {
                    const Icon = getCategoryIcon(item.category)
                    // 使用 Firestore 文檔 ID 作為 key（確保唯一性）
                    // item.id 現在應該是 Firestore 文檔 ID（因為 useFirestore 已經確保了這一點）
                    // 如果沒有，則使用 firestoreId 或索引作為後備
                    const uniqueKey = (item as any).firestoreId || item.id || `relief-${index}`
                    return (
                      <div 
                        key={uniqueKey} 
                        className="bg-white rounded-lg border border-gray-300 p-4 shadow-sm"
                        onMouseEnter={() => trackServiceView(item.name, item.category, item.provider)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-5 h-5 text-gray-600" />
                              <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium">提供機構：</span>
                              {item.provider}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(item.category)}`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-700">
                          {/* 渲染地點（支持多個） */}
                          {item.location && (Array.isArray(item.location) ? item.location.length > 0 : item.location.trim() !== '') && (
                            renderLocation(item.location)
                          )}
                          
                          {/* 渲染聯絡方式（支持多個） */}
                          {item.contact && (Array.isArray(item.contact) ? item.contact.length > 0 : item.contact.trim() !== '') && (
                            renderContact(item.contact)
                          )}

                          {item.openingHours && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span>開放時間：{item.openingHours}</span>
                            </div>
                          )}

                          {item.note && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                              {item.note}
                            </div>
                          )}
                        </div>

                        {item.source_ref && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              資料來源：
                              {(() => {
                                const sourceRef = item.source_ref.trim()
                                // 檢測是否為 URL（簡單檢測：以 http:// 或 https:// 開頭）
                                const isUrl = /^https?:\/\//i.test(sourceRef)
                                
                                if (isUrl) {
                                  return (
                                    <a
                                      href={sourceRef}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {sourceRef}
                                    </a>
                                  )
                                } else {
                                  // 如果不是 URL，顯示為普通文字（保留原有格式）
                                  return `救災資訊小冊子 v1.3 ${sourceRef}`
                                }
                              })()}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
            )}
          </div>

          {/* 底部說明 */}
          <div className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-gray-200 mt-6">
            （以上資訊統合民間資料，如有更新請聯繫管理員）
          </div>
        </>
      )}
    </Layout>
  )
}
