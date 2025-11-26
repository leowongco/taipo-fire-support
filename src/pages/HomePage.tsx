import { useState } from 'react'
import Layout from '../components/layout/Layout'
import NewsCard from '../components/feed/NewsCard'
import ResourceCard from '../components/resources/ResourceCard'
import SupportInfo from '../components/support/SupportInfo'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { Announcement, Resource } from '../types'
import { AlertTriangle } from 'lucide-react'

type TabType = 'news' | 'supply' | 'shelter' | 'support'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('news')
  const { data: announcements, loading: announcementsLoading, error: announcementsError } = useFirestore<Announcement>('announcements')
  const { data: resources, loading: resourcesLoading, error: resourcesError } = useFirestore<Resource>('resources')

  // Check for urgent announcements for emergency banner
  const hasUrgentAnnouncement = announcements.some((a) => a.isUrgent || a.tag === 'urgent')

  // Filter resources by category
  const supplyStations = resources.filter((r) => r.category === 'supply')
  const shelters = resources.filter((r) => r.category === 'shelter')

  return (
    <Layout>
      {/* Emergency Banner */}
      {hasUrgentAnnouncement && (
        <div className="sticky top-16 z-40 mb-4 bg-red-600 text-white px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">有緊急公告，請立即查看</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('news')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'news'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            新聞動態
          </button>
          <button
            onClick={() => setActiveTab('supply')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'supply'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            物資收集站
          </button>
          <button
            onClick={() => setActiveTab('shelter')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'shelter'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            庇護中心
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'support'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            支援資訊
          </button>
        </nav>
      </div>

      {/* Error Messages */}
      {(announcementsError || resourcesError) && (
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
                <li>選擇項目：<code className="bg-yellow-100 px-1 rounded">taipo-fire-suppoe</code></li>
                <li>前往「Firestore Database」頁面</li>
                <li>點擊「建立資料庫」或「啟用 Firestore」</li>
                <li>選擇「以測試模式啟動」</li>
                <li>選擇資料庫位置（建議：asia-east1）</li>
                <li>在「規則」標籤中部署安全規則</li>
              </ol>
              <details className="text-xs text-yellow-600">
                <summary className="cursor-pointer hover:text-yellow-800">查看詳細錯誤</summary>
                <pre className="mt-2 p-2 bg-yellow-100 rounded overflow-auto">
                  {announcementsError?.message || resourcesError?.message || '未知錯誤'}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'news' ? (
          <>
            {announcementsLoading ? (
              <SkeletonLoader />
            ) : announcementsError ? (
              <div className="text-center py-12 text-gray-500">
                <p>無法載入新聞動態</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>暫無新聞動態</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <NewsCard key={announcement.id} announcement={announcement} />
              ))
            )}
          </>
        ) : activeTab === 'supply' ? (
          <>
            {resourcesLoading ? (
              <SkeletonLoader />
            ) : resourcesError ? (
              <div className="text-center py-12 text-gray-500">
                <p>無法載入物資收集站信息</p>
              </div>
            ) : supplyStations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>暫無物資收集站信息</p>
              </div>
            ) : (
              supplyStations.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))
            )}
          </>
        ) : activeTab === 'shelter' ? (
          <>
            {resourcesLoading ? (
              <SkeletonLoader />
            ) : resourcesError ? (
              <div className="text-center py-12 text-gray-500">
                <p>無法載入庇護中心信息</p>
              </div>
            ) : shelters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>暫無庇護中心信息</p>
              </div>
            ) : (
              shelters.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))
            )}
          </>
        ) : (
          <SupportInfo />
        )}
      </div>
    </Layout>
  )
}

