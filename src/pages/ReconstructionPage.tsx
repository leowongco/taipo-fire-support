import { useState } from 'react'
import Layout from '../components/layout/Layout'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { ReconstructionInfo } from '../types'
import { formatTime } from '../utils/formatTime'
import { Building2, Calendar, Package, Bell, AlertCircle, Filter } from 'lucide-react'

type CategoryFilter = 'all' | 'progress' | 'timeline' | 'resources' | 'updates'
type StatusFilter = 'all' | 'active' | 'completed' | 'pending'

export default function ReconstructionPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: reconstructionInfo, loading, error } = useFirestore<ReconstructionInfo>('reconstructionInfo', {
    realtime: false,
    limit: 50
  })

  // 過濾重建資訊
  const filteredInfo = reconstructionInfo.filter((info) => {
    const matchesCategory = categoryFilter === 'all' || info.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || info.status === statusFilter
    return matchesCategory && matchesStatus
  })

  const getCategoryLabel = (category: ReconstructionInfo['category']) => {
    switch (category) {
      case 'progress':
        return '重建進度'
      case 'timeline':
        return '時間表'
      case 'resources':
        return '資源資訊'
      case 'updates':
        return '最新更新'
      default:
        return category
    }
  }

  const getCategoryIcon = (category: ReconstructionInfo['category']) => {
    switch (category) {
      case 'progress':
        return Building2
      case 'timeline':
        return Calendar
      case 'resources':
        return Package
      case 'updates':
        return Bell
      default:
        return Building2
    }
  }

  const getCategoryColor = (category: ReconstructionInfo['category']) => {
    switch (category) {
      case 'progress':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'timeline':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'resources':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'updates':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusColor = (status: ReconstructionInfo['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusLabel = (status: ReconstructionInfo['status']) => {
    switch (status) {
      case 'active':
        return '進行中'
      case 'completed':
        return '已完成'
      case 'pending':
        return '待處理'
      default:
        return status
    }
  }

  const getPriorityColor = (priority: ReconstructionInfo['priority']) => {
    switch (priority) {
      case 'urgent':
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

  const getPriorityLabel = (priority: ReconstructionInfo['priority']) => {
    switch (priority) {
      case 'urgent':
        return '緊急'
      case 'high':
        return '高'
      case 'medium':
        return '中'
      case 'low':
        return '低'
      default:
        return priority
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">災後重建資訊中心</h1>
        <p className="text-gray-600 text-sm">查看重建進度、時間表和相關資源資訊</p>
      </div>

      {/* 過濾器 */}
      {!loading && !error && reconstructionInfo.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* 分類過濾 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              分類：
            </p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'progress', 'timeline', 'resources', 'updates'] as CategoryFilter[]).map((category) => (
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

          {/* 狀態過濾 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">狀態：</p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'pending'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '全部' : getStatusLabel(status)}
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
              <h3 className="font-medium text-yellow-800 mb-1">無法載入重建資訊</h3>
              <p className="text-sm text-yellow-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 內容 */}
      <div className="space-y-4">
        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <div className="text-center py-12 text-gray-500">
            <p>無法載入重建資訊</p>
          </div>
        ) : filteredInfo.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>暫無重建資訊</p>
          </div>
        ) : (
          filteredInfo.map((info) => {
            const IconComponent = getCategoryIcon(info.category)
            return (
              <div key={info.id} className="bg-white rounded-lg border border-gray-300 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-lg text-gray-900">{info.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(info.category)}`}>
                        {getCategoryLabel(info.category)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(info.status)}`}>
                        {getStatusLabel(info.status)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(info.priority)}`}>
                        {getPriorityLabel(info.priority)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{info.content}</p>
                </div>

                {info.url && (
                  <div className="mb-4">
                    <a
                      href={info.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-red-600 hover:text-red-700 underline"
                    >
                      查看詳情 →
                    </a>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    來源：{info.source} • 更新於 {formatTime(info.timestamp)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}

