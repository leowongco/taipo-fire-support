import Layout from '../components/layout/Layout'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import EventStats from '../components/stats/EventStats'
import { useFirestore } from '../hooks/useFirestore'
import { Announcement } from '../types'
import { AlertTriangle, Phone, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: announcements, loading: announcementsLoading, error: announcementsError } = useFirestore<Announcement>('announcements', {
    realtime: false,
    limit: 50 // 限制最多讀取 50 條公告
  })

  return (
    <Layout>
      {/* Permanent Hotline Banner */}
      <div className="sticky top-16 z-40 mb-4 bg-orange-600 text-white px-4 py-3 rounded-lg flex items-center gap-2 shadow-md">
        <Phone className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">
          查詢大埔火災傷亡資訊查詢熱線：<a href="tel:1878999" className="font-bold underline hover:no-underline">1878 999</a>
        </p>
      </div>

      {/* Event Statistics */}
      <EventStats />

      {/* Error Messages */}
      {announcementsError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-2">連接 Firestore 時發生錯誤</h3>
              <p className="text-sm text-yellow-700 mb-3">
                這通常表示 Firestore 數據庫尚未正確設置。請按照以下步驟操作：
              </p>
              <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1 mb-3">
                <li>訪問 <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Firebase Console</a></li>
                <li>選擇項目：<code className="bg-yellow-100 px-1 rounded">taipo-fire-support</code></li>
                <li>前往「Firestore Database」頁面</li>
                <li>點擊「建立資料庫」或「啟用 Firestore」</li>
                <li>選擇「以測試模式啟動」</li>
                <li>選擇資料庫位置（建議：asia-east1）</li>
                <li>在「規則」標籤中部署安全規則</li>
              </ol>
              <details className="text-xs text-yellow-600">
                <summary className="cursor-pointer hover:text-yellow-800">查看詳細錯誤</summary>
                <pre className="mt-2 p-2 bg-yellow-100 rounded overflow-auto">
                  {announcementsError?.message || '未知錯誤'}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Announcements Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            重要公告
          </h2>
          <Link
            to="/news"
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
          >
            查看所有新聞
            <span>→</span>
          </Link>
        </div>
        <p className="text-gray-600 text-sm mb-4">管理員發布的重要公告</p>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcementsLoading ? (
          <SkeletonLoader />
        ) : announcementsError ? (
          <div className="text-center py-12 text-gray-500">
            <p>無法載入公告</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>暫無公告</p>
            <p className="text-sm text-gray-400 mt-2">管理員可以在後台添加公告</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{announcement.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <span className="font-medium">{announcement.source}</span>
                <span>•</span>
                <span>{new Date(announcement.timestamp.toDate()).toLocaleString('zh-HK')}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap mb-3">{announcement.content}</p>
              {announcement.url && (
                <a
                  href={announcement.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  查看原文
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
