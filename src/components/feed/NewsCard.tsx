import { useState } from 'react'
import { Announcement, News } from '../../types'
import { formatTime } from '../../utils/formatTime'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

interface NewsCardProps {
  announcement: Announcement | News
}

export default function NewsCard({ announcement }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 獲取分類標籤
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
      default: return null
    }
  }

  // 截取內容預覽（前 100 個字符）
  const previewLength = 100
  const hasLongContent = announcement.content.length > previewLength
  const contentPreview = hasLongContent 
    ? announcement.content.substring(0, previewLength) + '...'
    : announcement.content

  return (
    <div className="rounded-lg border bg-white border-gray-300 hover:border-gray-400 transition-colors">
      {/* 標題區域（可點擊） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-inset rounded-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <h3 className="font-semibold text-lg flex-1 text-gray-900">
                {announcement.title}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 來源標籤（僅 News 類型有） */}
                {'tag' in announcement && announcement.tag && (
                  <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                    announcement.tag === 'gov'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}>
                    {announcement.tag === 'gov' ? '政府新聞' : '新聞'}
                  </span>
                )}
                {/* AI 分類標籤（僅 News 類型有） */}
                {'newsCategory' in announcement && announcement.newsCategory && getCategoryLabel(announcement.newsCategory) && (
                  <span className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded whitespace-nowrap">
                    {getCategoryLabel(announcement.newsCategory)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">{announcement.source}</span>
              <span>•</span>
              <span>{formatTime(announcement.timestamp)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {hasLongContent && (
              <span className="text-xs text-gray-500">
                {isExpanded ? '收起' : '展開'}
              </span>
            )}
            {hasLongContent && (
              isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )
            )}
          </div>
        </div>
      </button>

      {/* 內容區域 */}
      <div className="px-4 pb-4">
        {hasLongContent ? (
          <>
            {/* 預覽內容 */}
            {!isExpanded && (
              <p className="text-gray-700 text-sm whitespace-pre-wrap mb-2">
                {contentPreview}
              </p>
            )}
            
            {/* 完整內容（展開時顯示） */}
            <div className={`transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            }`}>
              <div className={`pt-2 ${isExpanded ? 'border-t border-gray-200' : ''}`}>
                <div className="text-gray-700 whitespace-pre-wrap mb-3 leading-relaxed">
                  {announcement.content}
                </div>
              </div>
            </div>
            
            {/* 原文連結 */}
            {announcement.url && (
              <a
                href={announcement.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-sm mt-2"
              >
                查看原文
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </>
        ) : (
          <>
            {/* 短內容直接顯示 */}
            <div className="text-gray-700 mb-3 whitespace-pre-wrap leading-relaxed">
              {announcement.content}
            </div>
            {announcement.url && (
              <a
                href={announcement.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-sm"
              >
                查看原文
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}

