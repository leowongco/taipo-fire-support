import { useState } from 'react'
import { Announcement } from '../../types'
import { formatTime } from '../../utils/formatTime'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

interface NewsCardProps {
  announcement: Announcement
}

export default function NewsCard({ announcement }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isUrgent = announcement.isUrgent

  // 截取內容預覽（前 100 個字符）
  const previewLength = 100
  const hasLongContent = announcement.content.length > previewLength
  const contentPreview = hasLongContent 
    ? announcement.content.substring(0, previewLength) + '...'
    : announcement.content

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isUrgent
          ? 'bg-red-50 border-red-300'
          : 'bg-white border-gray-300 hover:border-gray-400'
      }`}
    >
      {/* 標題區域（可點擊） */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-inset rounded-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              <h3 className={`font-semibold text-lg flex-1 ${isUrgent ? 'text-red-900' : 'text-gray-900'}`}>
                {announcement.title}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 標籤 */}
                {announcement.tag && (
                  <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                    announcement.tag === 'urgent' 
                      ? 'bg-red-600 text-white'
                      : announcement.tag === 'gov'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}>
                    {announcement.tag === 'urgent' ? '緊急' : announcement.tag === 'gov' ? '政府新聞' : '新聞'}
                  </span>
                )}
                {/* 兼容舊數據：如果沒有 tag 但有 isUrgent，顯示緊急標籤 */}
                {!announcement.tag && isUrgent && (
                  <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded whitespace-nowrap">
                    緊急
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
                <p className="text-gray-700 whitespace-pre-wrap mb-3">
                  {announcement.content}
                </p>
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
            <p className="text-gray-700 mb-3 whitespace-pre-wrap">
              {announcement.content}
            </p>
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

