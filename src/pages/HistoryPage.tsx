import { useState } from 'react'
import Layout from '../components/layout/Layout'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { HistoryRecord } from '../types'
import { formatTime } from '../utils/formatTime'
import { Clock, FileText, Award, Search, Filter, AlertCircle } from 'lucide-react'

type CategoryFilter = 'all' | 'milestone' | 'news' | 'summary'
type ImportanceFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function HistoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: historyRecords, loading, error } = useFirestore<HistoryRecord>('historyRecords', {
    realtime: false,
    limit: 50
  })

  // 過濾歷史記錄
  const filteredRecords = historyRecords.filter((record) => {
    const matchesCategory = categoryFilter === 'all' || record.category === categoryFilter
    const matchesImportance = importanceFilter === 'all' || record.importance === importanceFilter
    const matchesSearch = 
      !searchQuery || 
      record.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCategory && matchesImportance && matchesSearch
  })

  // 按日期排序（最新的在前）
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    return b.date.toMillis() - a.date.toMillis()
  })

  const getCategoryLabel = (category: HistoryRecord['category']) => {
    switch (category) {
      case 'milestone':
        return '重要里程碑'
      case 'news':
        return '新聞摘要'
      case 'summary':
        return '經驗總結'
      default:
        return category
    }
  }

  const getCategoryIcon = (category: HistoryRecord['category']) => {
    switch (category) {
      case 'milestone':
        return Award
      case 'news':
        return FileText
      case 'summary':
        return Clock
      default:
        return FileText
    }
  }

  const getCategoryColor = (category: HistoryRecord['category']) => {
    switch (category) {
      case 'milestone':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'news':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'summary':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getImportanceColor = (importance: HistoryRecord['importance']) => {
    switch (importance) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getImportanceLabel = (importance: HistoryRecord['importance']) => {
    switch (importance) {
      case 'critical':
        return '關鍵'
      case 'high':
        return '高'
      case 'medium':
        return '中'
      case 'low':
        return '低'
      default:
        return importance
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">歷史記錄與經驗總結</h1>
        <p className="text-gray-600 text-sm">查看事件時間軸、重要里程碑和經驗總結</p>
      </div>

      {/* 搜索框 */}
      {!loading && !error && historyRecords.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索歷史記錄..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
        </div>
      )}

      {/* 過濾器 */}
      {!loading && !error && historyRecords.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* 分類過濾 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              分類：
            </p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'milestone', 'news', 'summary'] as CategoryFilter[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    categoryFilter === category
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? '全部' : getCategoryLabel(category)}
                </button>
              ))}
            </div>
          </div>

          {/* 重要性過濾 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">重要性：</p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'critical', 'high', 'medium', 'low'] as ImportanceFilter[]).map((importance) => (
                <button
                  key={importance}
                  onClick={() => setImportanceFilter(importance)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    importanceFilter === importance
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {importance === 'all' ? '全部' : getImportanceLabel(importance)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-1">無法載入歷史記錄</h3>
              <p className="text-sm text-yellow-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 時間軸視圖 */}
      <div className="space-y-6">
        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <div className="text-center py-12 text-gray-500">
            <p>無法載入歷史記錄</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>暫無歷史記錄</p>
          </div>
        ) : (
          <div className="relative">
            {/* 時間軸線 */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            
            {sortedRecords.map((record) => {
              const IconComponent = getCategoryIcon(record.category)
              const recordDate = record.date.toDate()
              
              return (
                <div key={record.id} className="relative pl-20 pb-8">
                  {/* 時間軸節點 */}
                  <div className="absolute left-6 top-2 w-4 h-4 bg-red-600 rounded-full border-4 border-white shadow-md"></div>
                  
                  {/* 日期標籤 */}
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-500">
                      {recordDate.toLocaleDateString('zh-HK', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* 記錄卡片 */}
                  <div className="bg-white rounded-lg border border-gray-300 p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <IconComponent className="w-5 h-5 text-gray-600" />
                          <h3 className="font-semibold text-lg text-gray-900">{record.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(record.category)}`}>
                            {getCategoryLabel(record.category)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getImportanceColor(record.importance)}`}>
                            {getImportanceLabel(record.importance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{record.content}</p>
                    </div>

                    {/* 標籤 */}
                    {record.tags && record.tags.length > 0 && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                          {record.tags.map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        記錄於 {formatTime(record.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

