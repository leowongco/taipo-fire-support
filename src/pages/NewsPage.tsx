import { useState } from 'react'
import Layout from '../components/layout/Layout'
import NewsCard from '../components/feed/NewsCard'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { News } from '../types'
import { AlertTriangle, Newspaper } from 'lucide-react'
import { trackEvent } from '../utils/analytics'

type NewsCategoryFilter = 'all' | 'event-update' | 'financial-support' | 'emotional-support' | 'accommodation' | 'medical-legal' | 'reconstruction' | 'statistics' | 'community-support' | 'government-announcement' | 'investigation' | 'general-news'
type NewsTagFilter = 'all' | 'gov' | 'news'

export default function NewsPage() {
  const [newsTagFilter, setNewsTagFilter] = useState<NewsTagFilter>('all')
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<NewsCategoryFilter>('all')
  const [newsItemsToShow, setNewsItemsToShow] = useState(10) // 初始顯示數量
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: news, loading: newsLoading, error: newsError } = useFirestore<News>('news', {
    realtime: false,
    limit: 200 // 限制最多讀取 200 條新聞
  })

  // 檢查是否有重要的事件更新（2小時內的事件更新類別）
  const hasRecentEventUpdate = news.some((n) => {
    if (n.newsCategory !== 'event-update') return false
    
    // Check if announcement is within 2 hours
    const now = new Date()
    const newsTime = n.timestamp.toDate()
    const diffInHours = (now.getTime() - newsTime.getTime()) / (1000 * 60 * 60)
    
    return diffInHours <= 2 // Only show if within 2 hours
  })

  // Filter news by tag and category
  const filteredNews = news.filter((n) => {
    // Tag filter
    if (newsTagFilter !== 'all') {
      if (newsTagFilter === 'gov' && n.tag !== 'gov') return false
      if (newsTagFilter === 'news' && n.tag !== 'news') return false
    }
    
    // Category filter
    if (newsCategoryFilter !== 'all') {
      if (n.newsCategory !== newsCategoryFilter) return false
    }
    
    return true
  })

  // Get displayed news (with pagination)
  const displayedNews = filteredNews.slice(0, newsItemsToShow)
  const hasMoreNews = filteredNews.length > newsItemsToShow

  // Reset pagination when filter changes
  const handleTagFilterChange = (filter: NewsTagFilter) => {
    setNewsTagFilter(filter)
    setNewsItemsToShow(10) // Reset to initial count
    trackEvent('filter', {
      event_category: 'news_tag',
      filter_value: filter,
      page: 'news',
    })
  }

  const handleCategoryFilterChange = (filter: NewsCategoryFilter) => {
    setNewsCategoryFilter(filter)
    setNewsItemsToShow(10) // Reset to initial count
    trackEvent('filter', {
      event_category: 'news_category',
      filter_value: filter,
      page: 'news',
    })
  }

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'event-update': return '事件更新'
      case 'financial-support': return '經濟支援'
      case 'emotional-support': return '情緒支援'
      case 'accommodation': return '住宿支援'
      case 'medical-legal': return '醫療/法律'
      case 'reconstruction': return '重建資訊'
      case 'statistics': return '統計數據'
      case 'community-support': return '社區支援'
      case 'government-announcement': return '政府公告'
      case 'investigation': return '調查'
      case 'general-news': return '一般新聞'
      default: return '未分類'
    }
  }

  // Load more news
  const loadMoreNews = () => {
    setNewsItemsToShow((prev) => prev + 10)
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-red-600" />
          新聞動態
        </h1>
        <p className="text-gray-600 text-sm">自動抓取的政府新聞公報和 RTHK 即時新聞</p>
      </div>

      {/* Recent Event Update Banner */}
      {hasRecentEventUpdate && (
        <div className="sticky top-28 z-40 mb-4 bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">有最新事件更新，請查看</p>
        </div>
      )}

      {/* Error Messages */}
      {newsError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-1">無法載入新聞資料</h3>
              <p className="text-sm text-yellow-700">{newsError.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* News Tag Filters */}
      {!newsLoading && !newsError && news.length > 0 && (
        <div className="space-y-4 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">來源分類：</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleTagFilterChange('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  newsTagFilter === 'all'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => handleTagFilterChange('gov')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  newsTagFilter === 'gov'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                政府新聞
                {news.filter((n) => n.tag === 'gov').length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {news.filter((n) => n.tag === 'gov').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleTagFilterChange('news')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  newsTagFilter === 'news'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                新聞
                {news.filter((n) => n.tag === 'news').length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-500 text-white text-xs rounded-full">
                    {news.filter((n) => n.tag === 'news').length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* News Category Filters */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">內容分類：</p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'event-update', 'financial-support', 'emotional-support', 'accommodation', 'medical-legal', 'reconstruction', 'statistics', 'community-support', 'government-announcement', 'investigation', 'general-news'] as NewsCategoryFilter[]).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryFilterChange(category)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    newsCategoryFilter === category
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? '全部' : getCategoryLabel(category)}
                  {category !== 'all' && news.filter((n) => n.newsCategory === category).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {news.filter((n) => n.newsCategory === category).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {newsLoading ? (
          <SkeletonLoader />
        ) : newsError ? (
          <div className="text-center py-12 text-gray-500">
            <p>無法載入新聞動態</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Newspaper className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>暫無{newsTagFilter === 'all' ? '' : newsTagFilter === 'gov' ? '政府' : '新聞'}動態</p>
          </div>
        ) : (
          <>
            {displayedNews.map((newsItem) => (
              <NewsCard key={newsItem.id} announcement={newsItem as any} />
            ))}
            
            {/* Load More Button */}
            {hasMoreNews && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMoreNews}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  載入更多 ({filteredNews.length - newsItemsToShow} 條)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

