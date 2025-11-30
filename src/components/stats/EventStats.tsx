import { useState, useEffect, useMemo } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { EventStats as EventStatsType, News } from '../../types'
import { calculateEventDuration } from '../../utils/calculateEventDuration'
import { AlertCircle, Clock, Users, Heart, Search } from 'lucide-react'
import SkeletonLoader from '../ui/SkeletonLoader'

export default function EventStats() {
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: statsList, loading, error } = useFirestore<EventStatsType>('eventStats', {
    realtime: false,
    limit: 10
  })
  const { data: newsList } = useFirestore<News>('news', {
    realtime: false,
    limit: 50 // 只需要少量新聞用於統計
  })
  const [, setCurrentTime] = useState(new Date())
  
  // 獲取最新的統計數據
  const latestStats: EventStatsType | null = statsList.length > 0 ? statsList[0] : null

  // 每秒更新時間以顯示精確的持續時間
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // 輔助函數：從來源字符串中提取來源名稱
  const extractSourceName = (sourceStr: string): string => {
    const match = sourceStr.match(/^([^:：]+)[:：]/)
    if (match) {
      return match[1].trim()
    }
    return sourceStr.trim()
  }

  // 輔助函數：從來源字符串中提取標題（用於查找新聞）
  const extractTitleFromSource = (sourceStr: string): string | null => {
    const match = sourceStr.match(/^[^:：]+[:：]\s*(.+)$/)
    if (match) {
      return match[1].trim()
    }
    return null
  }

  // 輔助函數：根據來源名稱和標題查找對應的新聞 URL
  const findNewsUrl = useMemo(() => {
    return (sourceName: string, title: string | null | undefined, newsList: News[]): string | null => {
      if (!title) return null

      // 根據來源名稱匹配新聞來源
      let sourceMatch: string | null = null
      if (sourceName.includes('RTHK') || sourceName.includes('香港電台')) {
        sourceMatch = '香港電台 (RTHK)'
      } else if (sourceName.includes('政府') || sourceName.includes('Gov')) {
        sourceMatch = '香港政府新聞公報'
      } else if (sourceName.includes('Google')) {
        sourceMatch = 'Google News'
      }

      if (!sourceMatch) return null

      // 查找匹配的新聞
      const matchedNews = newsList.find((news) => {
        if (news.source !== sourceMatch) return false
        // 檢查標題是否相似（包含關鍵詞）
        const newsTitle = news.title.toLowerCase()
        const searchTitle = title.toLowerCase()
        
        // 提取標題的主要部分（去除標點符號和空格）
        const normalize = (str: string) => str.replace(/[^\w\u4e00-\u9fa5]/g, '')
        const normalizedNews = normalize(newsTitle)
        const normalizedSearch = normalize(searchTitle)
        
        // 如果標題包含搜索標題的主要部分，認為匹配
        return normalizedNews.includes(normalizedSearch) || normalizedSearch.includes(normalizedNews)
      })

      return matchedNews?.url || null
    }
  }, [])

  // 格式化來源顯示（只顯示來源名稱，帶連結）
  const formatSourceWithLinks = useMemo(() => {
    if (!latestStats?.source) return null

    // 按逗號分割來源
    const sources = latestStats.source.split(',').map(s => s.trim()).filter(s => s.length > 0)
    
    return sources.map((source, index) => {
      const sourceName = extractSourceName(source)
      const title = extractTitleFromSource(source)
      const url = findNewsUrl(sourceName, title, newsList)
      
      if (url) {
        return (
          <span key={index}>
            {index > 0 && <span className="mx-1">、</span>}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {sourceName}
            </a>
          </span>
        )
      } else {
        return (
          <span key={index}>
            {index > 0 && <span className="mx-1">、</span>}
            {sourceName}
          </span>
        )
      }
    })
  }, [latestStats?.source, newsList, findNewsUrl])

  // 格式化已驗證來源顯示（只顯示來源名稱，帶連結）
  const formatVerifiedSourcesWithLinks = useMemo(() => {
    if (!latestStats?.verifiedSources || latestStats.verifiedSources.length === 0) return null
    
    return latestStats.verifiedSources.map((source, index) => {
      const sourceName = extractSourceName(source)
      const title = extractTitleFromSource(source)
      const url = findNewsUrl(sourceName, title, newsList)
      
      if (url) {
        return (
          <span key={index}>
            {index > 0 && <span className="mx-1">、</span>}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {sourceName}
            </a>
          </span>
        )
      } else {
        return (
          <span key={index}>
            {index > 0 && <span className="mx-1">、</span>}
            {sourceName}
          </span>
        )
      }
    })
  }, [latestStats?.verifiedSources, newsList, findNewsUrl])

  // 條件返回必須在所有 Hooks 之後
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-6 mb-6">
        <SkeletonLoader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-yellow-800 mb-1">無法載入事件統計</h3>
            <p className="text-sm text-yellow-700">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!latestStats) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6 text-center text-gray-500">
        <p>暫無事件統計數據</p>
      </div>
    )
  }

  // 計算事件持續時間
  const duration = calculateEventDuration(latestStats.eventStartDate)
  
  // 計算火災持續時間（2025年11月26日 14:51—2025年11月28日 10:18）
  const fireStartDate = new Date('2025-11-26T14:51:00+08:00')
  const fireEndDate = new Date('2025-11-28T10:18:00+08:00')
  const fireDuration = fireEndDate.getTime() - fireStartDate.getTime()
  const fireDurationDays = Math.floor(fireDuration / (1000 * 60 * 60 * 24))
  const fireDurationHours = Math.floor((fireDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const fireDurationMinutes = Math.floor((fireDuration % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-3 md:p-6 mb-6">
      <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 md:mb-4">事件統計</h2>
      
      {/* 第一行：時間 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4">
        {/* 事件持續時間 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-semibold text-blue-900 text-sm md:text-base">事件持續</h3>
          </div>
          <p className="text-lg md:text-xl text-blue-500 font-mono leading-tight font-semibold mb-1">{duration.formattedWithSeconds}</p>
          <p className="text-xs md:text-sm text-blue-600">
            發生時間：{latestStats.eventStartDate.toDate().toLocaleString('zh-HK', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </p>
        </div>

        {/* 火災持續時間 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-semibold text-blue-900 text-sm md:text-base">火災持續</h3>
          </div>
          <p className="text-lg md:text-xl text-blue-400 font-mono leading-tight font-semibold mb-1">
            {fireDurationDays}天{fireDurationHours}時{fireDurationMinutes}分
          </p>
          <div className="text-xs md:text-sm text-blue-600 space-y-0.5">
            <p>
              開始：{fireStartDate.toLocaleString('zh-HK', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p>
              結束：{fireEndDate.toLocaleString('zh-HK', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* 第二行：死亡、受傷、失蹤人數 */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {/* 死亡人數 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-1 md:gap-2 mb-2 justify-center md:justify-start">
            <Heart className="w-4 h-4 md:w-5 md:h-5 text-red-600 flex-shrink-0" />
            <h3 className="font-semibold text-red-900 text-sm md:text-base">死亡</h3>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-red-700 text-center md:text-left">{latestStats.casualties}</p>
          <p className="text-xs md:text-sm text-red-600 text-center md:text-left">人</p>
        </div>

        {/* 受傷人數 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-1 md:gap-2 mb-2 justify-center md:justify-start">
            <Users className="w-4 h-4 md:w-5 md:h-5 text-orange-600 flex-shrink-0" />
            <h3 className="font-semibold text-orange-900 text-sm md:text-base">受傷</h3>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-orange-700 text-center md:text-left">{latestStats.injured}</p>
          <p className="text-xs md:text-sm text-orange-600 text-center md:text-left">人</p>
        </div>

        {/* 失蹤人數 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center gap-1 md:gap-2 mb-2 justify-center md:justify-start">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 flex-shrink-0" />
            <h3 className="font-semibold text-yellow-900 text-sm md:text-base">失蹤</h3>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-yellow-700 text-center md:text-left">{latestStats.missing}</p>
          <p className="text-xs md:text-sm text-yellow-600 text-center md:text-left">人</p>
        </div>
      </div>

      {/* 數據來源和更新時間 */}
      <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-gray-200 space-y-1 md:space-y-2">
        <div className="flex flex-col md:flex-row md:items-start md:items-center md:justify-between text-[10px] md:text-xs text-gray-500 gap-1 md:gap-0">
          <div className="flex-1 min-w-0">
            <span className="block">
              數據來源：{formatSourceWithLinks || latestStats.source}
            </span>
          </div>
          <span className="flex-shrink-0 whitespace-nowrap">
            最後更新：{latestStats.lastUpdated.toDate().toLocaleString('zh-HK', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        {latestStats.verifiedSources && latestStats.verifiedSources.length > 0 && (
          <div className="text-xs text-gray-500 break-words">
            <span className="whitespace-nowrap">已驗證來源：</span>
            <span className="break-words">
              {formatVerifiedSourcesWithLinks || latestStats.verifiedSources.join('、')}
            </span>
          </div>
        )}
        {latestStats.pendingUpdates && Object.keys(latestStats.pendingUpdates).length > 0 && (
          <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
            <p className="font-medium mb-1">待驗證數據：</p>
            {latestStats.pendingUpdates.casualties && (
              <p>死亡人數：{latestStats.pendingUpdates.casualties.value} 人（已確認來源：{latestStats.pendingUpdates.casualties.sources.length} 個，需要 2 個來源確認）</p>
            )}
            {latestStats.pendingUpdates.injured && (
              <p>受傷人數：{latestStats.pendingUpdates.injured.value} 人（已確認來源：{latestStats.pendingUpdates.injured.sources.length} 個，需要 2 個來源確認）</p>
            )}
            {latestStats.pendingUpdates.missing && (
              <p>失蹤人數：{latestStats.pendingUpdates.missing.value} 人（已確認來源：{latestStats.pendingUpdates.missing.sources.length} 個，需要 2 個來源確認）</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

