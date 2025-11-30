import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged, User } from 'firebase/auth'
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import Layout from '../components/layout/Layout'
import { useFirestore } from '../hooks/useFirestore'
import { Announcement, News, Location, EventStats, ReconstructionInfo, HistoryRecord, FinancialAid, Service, ReliefService } from '../types'
import { LogOut, Plus, Edit, Trash2, X, User as UserIcon, RefreshCw } from 'lucide-react'
import MultiInputField from '../components/admin/MultiInputField'
import { renderContact } from '../utils/renderContact'
import { renderLocation } from '../utils/renderLocation'

type CollectionType = 'announcements' | 'news' | 'locations' | 'eventStats' | 'reconstructionInfo' | 'historyRecords' | 'financialAid' | 'services' | 'reliefServices'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<CollectionType>('announcements')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const navigate = useNavigate()

  // 管理後台使用實時監聽以獲得即時更新，但添加限制以減少讀取操作
  const { data: announcements } = useFirestore<Announcement>('announcements', { realtime: true, limit: 100 })
  const { data: news } = useFirestore<News>('news', { realtime: true, limit: 200 })
  const { data: locations } = useFirestore<Location>('locations', { realtime: true, limit: 500 })
  const { data: eventStats } = useFirestore<EventStats>('eventStats', { realtime: true, limit: 10 })
  const { data: reconstructionInfo } = useFirestore<ReconstructionInfo>('reconstructionInfo', { realtime: true, limit: 50 })
  const { data: historyRecords } = useFirestore<HistoryRecord>('historyRecords', { realtime: true, limit: 50 })
  const { data: financialAid } = useFirestore<FinancialAid>('financialAid', { realtime: true, limit: 100 })
  const { data: services } = useFirestore<Service>('services', { realtime: true, limit: 500 })
  const { data: reliefServices } = useFirestore<ReliefService>('reliefServices', { realtime: true, limit: 500 })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/admin')
      } else {
        setUser(user)
      }
    })
    return () => unsubscribe()
  }, [navigate])

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) {
      return
    }
    
    setLogoutLoading(true)
    try {
      await signOut(auth)
      navigate('/admin')
    } catch (error: any) {
      console.error('登出錯誤:', error)
      alert('登出失敗，請重試')
    } finally {
      setLogoutLoading(false)
    }
  }

  const handleDelete = async (collectionName: CollectionType, id: string) => {
    if (confirm('確定要刪除這項嗎？')) {
      await deleteDoc(doc(db, collectionName, id))
    }
  }

  const handleReclassifyNews = async (newsId: string) => {
    if (!confirm('確定要重新分類這則新聞嗎？AI 將重新分析並更新分類。')) {
      return
    }

    try {
      // 構建 Cloud Functions URL
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
      if (!projectId) {
        alert('錯誤：無法獲取 Firebase 項目 ID，請檢查環境變量配置')
        return
      }

      // Firebase Functions v2 的 URL 格式
      const functionUrl = `https://asia-east1-${projectId}.cloudfunctions.net/reclassifyNews`

      // 獲取當前用戶的 ID token
      const user = auth.currentUser
      if (!user) {
        alert('請先登入')
        return
      }

      const idToken = await user.getIdToken()

      console.log('調用重新分類函數:', functionUrl)

      // 調用 Cloud Function
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newsId }),
      })

      // 檢查響應狀態
      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` }
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        alert(`重新分類成功！\n舊分類：${result.oldCategory || '無'}\n新分類：${result.newCategory}`)
        // 刷新頁面以顯示更新後的分類
        window.location.reload()
      } else {
        alert(`重新分類失敗：${result.error || '未知錯誤'}`)
      }
    } catch (error: any) {
      console.error('重新分類錯誤:', error)
      
      // 提供更詳細的錯誤信息
      let errorMessage = '未知錯誤'
      if (error.message) {
        errorMessage = error.message
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '網絡連接失敗。請檢查：\n1. Cloud Function 是否已部署\n2. 網絡連接是否正常\n3. 瀏覽器控制台是否有更多錯誤信息'
      }
      
      alert(`重新分類失敗：${errorMessage}\n\n請檢查瀏覽器控制台以獲取更多詳細信息。`)
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
          {user && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <UserIcon className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          {logoutLoading ? '登出中...' : '登出'}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('announcements')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'announcements'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            公告管理
          </button>
          <button
            onClick={() => {
              setActiveTab('news')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'news'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            新聞管理
          </button>
          <button
            onClick={() => {
              setActiveTab('locations')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'locations'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            地址簿管理
          </button>
          <button
            onClick={() => {
              setActiveTab('eventStats')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'eventStats'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            事件統計管理
          </button>
          <button
            onClick={() => {
              setActiveTab('reconstructionInfo')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'reconstructionInfo'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            重建資訊管理
          </button>
          <button
            onClick={() => {
              setActiveTab('historyRecords')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'historyRecords'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            歷史記錄管理
          </button>
          <button
            onClick={() => {
              setActiveTab('financialAid')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'financialAid'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            經濟援助管理
          </button>
          <button
            onClick={() => {
              setActiveTab('reliefServices')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'reliefServices'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            支援服務管理
          </button>
        </nav>
      </div>

      {/* Add Button */}
      <div className="mb-4">
        <button
          onClick={() => {
            setShowForm(true)
            setEditingId(null)
          }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增{activeTab === 'announcements' ? '公告' : activeTab === 'news' ? '新聞' : activeTab === 'locations' ? '收集站' : activeTab === 'eventStats' ? '事件統計' : activeTab === 'reconstructionInfo' ? '重建資訊' : activeTab === 'historyRecords' ? '歷史記錄' : activeTab === 'financialAid' ? '經濟援助' : activeTab === 'services' ? '特別服務' : activeTab === 'reliefServices' ? '支援服務' : ''}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <FormModal
          collectionName={activeTab}
          editingId={editingId}
          editingData={
            editingId
              ? activeTab === 'announcements'
                ? announcements.find((a) => a.id === editingId)
                : activeTab === 'news'
                ? news.find((n) => n.id === editingId)
                : activeTab === 'locations'
                ? locations.find((l) => l.id === editingId)
                : activeTab === 'eventStats'
                ? eventStats.find((e) => e.id === editingId)
                : activeTab === 'reconstructionInfo'
                ? reconstructionInfo.find((r) => r.id === editingId)
                : activeTab === 'historyRecords'
                ? historyRecords.find((h) => h.id === editingId)
                : activeTab === 'financialAid'
                ? financialAid.find((f) => f.id === editingId)
                : activeTab === 'services'
                ? services.find((s) => s.id === editingId)
                : activeTab === 'reliefServices'
                ? reliefServices.find((r) => r.id === editingId)
                : null
              : null
          }
          onClose={() => {
            setShowForm(false)
            setEditingId(null)
          }}
        />
      )}

      {/* List */}
      <div className="space-y-4">
        {activeTab === 'announcements' ? (
          <>
            {announcements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無公告</p>
            ) : (
              announcements.map((item) => (
                <AnnouncementItem
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                  onDelete={() => handleDelete('announcements', item.id)}
                />
              ))
            )}
          </>
        ) : activeTab === 'news' ? (
          <>
            {news.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無新聞</p>
            ) : (
              news.map((item) => (
                <NewsItem
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                  onDelete={() => handleDelete('news', item.id)}
                  onReclassify={() => handleReclassifyNews(item.id)}
                />
              ))
            )}
          </>
        ) : activeTab === 'locations' ? (
          <>
            {locations.filter(l => l.type === 'collection_point').length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無收集站</p>
            ) : (
              locations
                .filter(l => l.type === 'collection_point')
                .map((item) => (
                  <LocationItem
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditingId(item.id)
                      setShowForm(true)
                    }}
                    onDelete={() => handleDelete('locations', item.id)}
                  />
                ))
            )}
          </>
        ) : activeTab === 'eventStats' ? (
          <>
            {eventStats.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無事件統計數據</p>
            ) : (
              eventStats.map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">事件統計</h3>
                      <div className="grid grid-cols-3 gap-4 mb-2">
                        <div>
                          <p className="text-sm text-gray-600">死亡人數</p>
                          <p className="text-xl font-bold text-red-600">{item.casualties}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">受傷人數</p>
                          <p className="text-xl font-bold text-orange-600">{item.injured}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">失蹤人數</p>
                          <p className="text-xl font-bold text-yellow-600">{item.missing}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        事件開始：{item.eventStartDate.toDate().toLocaleDateString('zh-HK')}
                      </p>
                      <p className="text-sm text-gray-500">
                        數據來源：{item.source}
                      </p>
                      <p className="text-sm text-gray-500">
                        最後更新：{item.lastUpdated.toDate().toLocaleString('zh-HK')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                      setEditingId(item.id)
                      setShowForm(true)
                    }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                ))
            )}
          </>
        ) : activeTab === 'reconstructionInfo' ? (
          <>
            {reconstructionInfo.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無重建資訊</p>
            ) : (
              reconstructionInfo.map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.content}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                          {item.category === 'progress' ? '重建進度' : item.category === 'timeline' ? '時間表' : item.category === 'resources' ? '資源資訊' : '最新更新'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                          {item.status === 'active' ? '進行中' : item.status === 'completed' ? '已完成' : '待處理'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                          {item.priority === 'urgent' ? '緊急' : item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">來源：{item.source}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('reconstructionInfo', item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        ) : activeTab === 'historyRecords' ? (
          <>
            {historyRecords.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無歷史記錄</p>
            ) : (
              historyRecords.map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.content}</p>
                      <div className="flex gap-2 flex-wrap mb-2">
                        <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                          {item.category === 'milestone' ? '重要里程碑' : item.category === 'news' ? '新聞摘要' : '經驗總結'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                          {item.importance === 'critical' ? '關鍵' : item.importance === 'high' ? '高' : item.importance === 'medium' ? '中' : '低'}
                        </span>
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {item.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        日期：{item.date.toDate().toLocaleDateString('zh-HK')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                        setEditingId(item.id)
                        setShowForm(true)
                      }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('historyRecords', item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        ) : activeTab === 'financialAid' ? (
          <>
            {financialAid.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無經濟援助資料</p>
            ) : (
              financialAid.map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.provider}</p>
                      <p className="text-xl font-bold text-red-600 mb-2">{item.amount}</p>
                      <div className="flex gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          item.status === 'open' ? 'bg-green-100 text-green-800' :
                          item.status === 'limited' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status === 'open' ? '開放中' : item.status === 'limited' ? '名額有限' : '已結束'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                          {item.type === 'cash' ? '現金' : item.type === 'goods' ? '物資' : '代金券'}
                        </span>
                      </div>
                      {item.location && (Array.isArray(item.location) ? item.location.length > 0 : item.location.trim() !== '') && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">地點：</span>
                          {renderLocation(item.location)}
                        </div>
                      )}
                      {item.contact && (Array.isArray(item.contact) ? item.contact.length > 0 : item.contact.trim() !== '') && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">聯絡：</span>
                          {renderContact(item.contact)}
                        </div>
                      )}
                      {item.requirement && <p className="text-sm text-gray-600 mb-1">需要：{item.requirement}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                      setEditingId(item.id)
                      setShowForm(true)
                    }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('financialAid', item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                ))
            )}
          </>
        ) : activeTab === 'services' ? (
          <>
            {services.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無特別服務資料</p>
            ) : (
              services.map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.service}</p>
                      <div className="flex gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          item.category === 'medical' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'pets' ? 'bg-purple-100 text-purple-800' :
                          item.category === 'emotional' ? 'bg-pink-100 text-pink-800' :
                          item.category === 'funeral' ? 'bg-gray-100 text-gray-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {item.category === 'medical' ? '醫療' : item.category === 'pets' ? '寵物' : item.category === 'emotional' ? '情緒支援' : item.category === 'funeral' ? '殯儀' : '住宿'}
                        </span>
                      </div>
                      {item.location && <p className="text-sm text-gray-600 mb-1">地點：{item.location}</p>}
                      {item.contact && <p className="text-sm text-gray-600 mb-1">聯絡：{item.contact}</p>}
                      {item.validUntil && <p className="text-sm text-gray-600 mb-1">有效期至：{item.validUntil}</p>}
                      {item.note && <p className="text-sm text-yellow-600 mb-1">備註：{item.note}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('services', item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        ) : activeTab === 'reliefServices' ? (
          <>
            {reliefServices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無支援服務資料</p>
            ) : (
              reliefServices.sort((a, b) => (a.order || 0) - (b.order || 0)).map((item) => (
                <div key={item.id} className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.name}</h3>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">提供機構：</span>
                        {item.provider}
                      </p>
                      <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                      <div className="flex gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          item.category === 'emotional' ? 'bg-pink-100 text-pink-800' :
                          item.category === 'childcare' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'education' ? 'bg-purple-100 text-purple-800' :
                          item.category === 'accommodation' ? 'bg-green-100 text-green-800' :
                          item.category === 'medical' ? 'bg-red-100 text-red-800' :
                          item.category === 'legal' ? 'bg-yellow-100 text-yellow-800' :
                          item.category === 'funeral' ? 'bg-gray-100 text-gray-800' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {item.category === 'emotional' ? '情緒支援' : item.category === 'childcare' ? '託兒' : item.category === 'education' ? '學業' : item.category === 'accommodation' ? '住宿' : item.category === 'medical' ? '醫療' : item.category === 'legal' ? '法律' : item.category === 'funeral' ? '殯儀' : '寵物'}
                        </span>
                      </div>
                      {item.location && (
                        <p className="text-sm text-gray-600 mb-1">
                          地點：{Array.isArray(item.location) ? item.location.join(' | ') : item.location}
                        </p>
                      )}
                      {item.contact && (
                        <p className="text-sm text-gray-600 mb-1">
                          聯絡：{Array.isArray(item.contact) ? item.contact.join(' | ') : item.contact}
                        </p>
                      )}
                      {item.openingHours && <p className="text-sm text-gray-600 mb-1">開放時間：{item.openingHours}</p>}
                      {item.note && <p className="text-sm text-yellow-600 mb-1">備註：{item.note}</p>}
                      {item.source_ref && <p className="text-xs text-gray-500 mt-2">資料來源：{item.source_ref}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="編輯"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete('reliefServices', item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="刪除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        ) : null}
      </div>
    </Layout>
  )
}

// Form Modal Component
function FormModal({
  collectionName,
  editingId,
  editingData,
  onClose,
}: {
  collectionName: CollectionType
  editingId: string | null
  editingData: Announcement | Location | EventStats | ReconstructionInfo | HistoryRecord | FinancialAid | Service | ReliefService | null | undefined
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 用於管理多個聯絡方式和地址的狀態
  const [contactValues, setContactValues] = useState<string[]>([])
  const [locationValues, setLocationValues] = useState<string[]>([])
  
  // 初始化多項輸入的值（當編輯時）
  useEffect(() => {
    if (collectionName === 'reliefServices' && editingData) {
      const service = editingData as ReliefService
      // 處理聯絡方式
      if (Array.isArray(service.contact)) {
        setContactValues(service.contact)
      } else if (service.contact) {
        setContactValues([service.contact])
      } else {
        setContactValues([''])
      }
      // 處理地址
      if (Array.isArray(service.location)) {
        setLocationValues(service.location)
      } else if (service.location) {
        setLocationValues([service.location])
      } else {
        setLocationValues([''])
      }
    } else if (collectionName === 'financialAid' && editingData) {
      const aid = editingData as FinancialAid
      // 處理聯絡方式
      if (Array.isArray(aid.contact)) {
        setContactValues(aid.contact)
      } else if (aid.contact) {
        setContactValues([aid.contact])
      } else {
        setContactValues([''])
      }
      // 處理地址
      if (Array.isArray(aid.location)) {
        setLocationValues(aid.location)
      } else if (aid.location) {
        setLocationValues([aid.location])
      } else {
        setLocationValues([''])
      }
    } else {
      setContactValues([''])
      setLocationValues([''])
    }
  }, [collectionName, editingData])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      if (collectionName === 'announcements') {
        const announcementData = {
          title: data.title as string,
          content: data.content as string,
          source: data.source as string,
          url: data.url as string || undefined,
          timestamp: editingId ? (editingData as Announcement)?.timestamp : Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'announcements', editingId), announcementData)
        } else {
          await addDoc(collection(db, 'announcements'), announcementData)
        }
      } else if (collectionName === 'news') {
        const newsData = {
          title: data.title as string,
          content: data.content as string,
          source: data.source as string,
          url: data.url as string || undefined,
          tag: (data.tag as 'gov' | 'news' | '') || undefined,
          newsCategory: (data.newsCategory as News['newsCategory'] | '') || undefined,
          timestamp: editingId ? (editingData as News)?.timestamp : Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'news', editingId), newsData)
        } else {
          await addDoc(collection(db, 'news'), newsData)
        }
      } else if (collectionName === 'locations') {
        const locationData = {
          name: data.name as string,
          address: data.address as string,
          type: 'collection_point' as const, // 固定為收集站
        }

        if (editingId) {
          await updateDoc(doc(db, 'locations', editingId), locationData)
        } else {
          await addDoc(collection(db, 'locations'), locationData)
        }
      } else if (collectionName === 'eventStats') {
        const eventStartDate = data.eventStartDate ? new Date(data.eventStartDate as string) : new Date()
        const statsData: any = {
          eventStartDate: Timestamp.fromDate(eventStartDate),
          casualties: parseInt(data.casualties as string) || 0,
          injured: parseInt(data.injured as string) || 0,
          missing: parseInt(data.missing as string) || 0,
          lastUpdated: Timestamp.now(),
          source: (data.source as string)?.trim() || '手動輸入',
        }

        if (editingId) {
          await updateDoc(doc(db, 'eventStats', editingId), statsData)
        } else {
          await addDoc(collection(db, 'eventStats'), statsData)
        }
      } else if (collectionName === 'reconstructionInfo') {
        const reconstructionData: any = {
          title: (data.title as string)?.trim() || '',
          content: (data.content as string)?.trim() || '',
          category: data.category as 'progress' | 'timeline' | 'resources' | 'updates',
          status: data.status as 'active' | 'completed' | 'pending',
          priority: data.priority as 'low' | 'medium' | 'high' | 'urgent',
          timestamp: Timestamp.now(),
          source: (data.source as string)?.trim() || '管理員',
        }

        if (data.url && (data.url as string).trim()) {
          reconstructionData.url = (data.url as string).trim()
        }
        
        if (editingId) {
          await updateDoc(doc(db, 'reconstructionInfo', editingId), reconstructionData)
        } else {
          await addDoc(collection(db, 'reconstructionInfo'), reconstructionData)
        }
      } else if (collectionName === 'historyRecords') {
        const recordDate = data.recordDate ? new Date(data.recordDate as string) : new Date()
        const tags = (data.tags as string)?.trim() 
          ? (data.tags as string).split(',').map(t => t.trim()).filter(t => t)
          : []
        
        const historyData: any = {
          title: (data.title as string)?.trim() || '',
          content: (data.content as string)?.trim() || '',
          date: Timestamp.fromDate(recordDate),
          category: data.category as 'milestone' | 'news' | 'summary',
          tags: tags,
          importance: data.importance as 'low' | 'medium' | 'high' | 'critical',
          timestamp: Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'historyRecords', editingId), historyData)
        } else {
          await addDoc(collection(db, 'historyRecords'), historyData)
        }
      } else if (collectionName === 'financialAid') {
        // 處理多個聯絡方式和地址（直接從 state 獲取）
        const contact = contactValues.length === 0 
          ? ''
          : contactValues.length === 1 
            ? contactValues[0] 
            : contactValues
        const location = locationValues.length === 0
          ? ''
          : locationValues.length === 1
            ? locationValues[0]
            : locationValues
        
        const financialAidData: any = {
          provider: (data.provider as string)?.trim() || '',
          title: (data.title as string)?.trim() || '',
          amount: (data.amount as string)?.trim() || '',
          location: location,
          contact: contact,
          time: (data.time as string)?.trim() || '',
          requirement: (data.requirement as string)?.trim() || '',
          type: data.type as 'cash' | 'goods' | 'voucher',
          status: data.status as 'open' | 'closed' | 'limited',
          targetGroup: (data.targetGroup as string)?.trim() || null,
          sourceRef: (data.sourceRef as string)?.trim() || '',
          updatedAt: Timestamp.now(),
        }

        if (!editingId) {
          financialAidData.createdAt = Timestamp.now()
        }
        
        if (editingId) {
          await updateDoc(doc(db, 'financialAid', editingId), financialAidData)
        } else {
          await addDoc(collection(db, 'financialAid'), financialAidData)
        }
      } else if (collectionName === 'services') {
        const serviceData: any = {
          category: data.category as 'medical' | 'pets' | 'emotional' | 'funeral' | 'accommodation',
          name: (data.name as string)?.trim() || '',
          service: (data.service as string)?.trim() || '',
          target: (data.target as string)?.trim() || '',
          location: (data.location as string)?.trim() || '',
          contact: (data.contact as string)?.trim() || '',
          validUntil: (data.validUntil as string)?.trim() || '',
          note: (data.note as string)?.trim() || '',
          sourceRef: (data.sourceRef as string)?.trim() || '',
          updatedAt: Timestamp.now(),
        }

        if (!editingId) {
          serviceData.createdAt = Timestamp.now()
        }

        if (editingId) {
          await updateDoc(doc(db, 'services', editingId), serviceData)
        } else {
          await addDoc(collection(db, 'services'), serviceData)
        }
      } else if (collectionName === 'reliefServices') {
        // 處理多個聯絡方式和地址（直接從 state 獲取）
        const contact = contactValues.length === 0 
          ? ''
          : contactValues.length === 1 
            ? contactValues[0] 
            : contactValues
        const location = locationValues.length === 0
          ? ''
          : locationValues.length === 1
            ? locationValues[0]
            : locationValues

        const reliefServiceData: any = {
          category: data.category as 'emotional' | 'childcare' | 'education' | 'accommodation' | 'medical' | 'legal' | 'funeral' | 'pets',
          name: (data.name as string)?.trim() || '',
          provider: (data.provider as string)?.trim() || '',
          description: (data.description as string)?.trim() || '',
          contact: contact,
          location: location,
          openingHours: (data.openingHours as string)?.trim() || null,
          note: (data.note as string)?.trim() || null,
          source_ref: (data.source_ref as string)?.trim() || null,
          order: parseInt(data.order as string) || 0,
          updatedAt: Timestamp.now(),
        }

        if (!editingId) {
          reliefServiceData.createdAt = Timestamp.now()
        }

        if (editingId) {
          await updateDoc(doc(db, 'reliefServices', editingId), reliefServiceData)
        } else {
          await addDoc(collection(db, 'reliefServices'), reliefServiceData)
        }
      }

      onClose()
    } catch (err: any) {
      setError(err.message || '操作失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {editingId ? '編輯' : '新增'}
            {collectionName === 'announcements' ? '公告' 
              : collectionName === 'news' ? '新聞'
              : collectionName === 'locations' ? '收集站'
              : collectionName === 'eventStats' ? '事件統計'
              : collectionName === 'reconstructionInfo' ? '重建資訊'
              : collectionName === 'historyRecords' ? '歷史記錄'
              : collectionName === 'financialAid' ? '經濟援助'
              : collectionName === 'services' ? '特別服務'
              : collectionName === 'reliefServices' ? '支援服務'
              : ''}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {collectionName === 'announcements' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as Announcement)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
                <textarea
                  name="content"
                  required
                  rows={4}
                  defaultValue={(editingData as Announcement)?.content || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">來源 *</label>
                <input
                  name="source"
                  type="text"
                  required
                  defaultValue={(editingData as Announcement)?.source || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">連結（選填）</label>
                <input
                  name="url"
                  type="url"
                  defaultValue={(editingData as Announcement)?.url || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'news' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as News)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
                <textarea
                  name="content"
                  required
                  rows={4}
                  defaultValue={(editingData as News)?.content || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">來源 *</label>
                <input
                  name="source"
                  type="text"
                  required
                  defaultValue={(editingData as News)?.source || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">連結（選填）</label>
                <input
                  name="url"
                  type="url"
                  defaultValue={(editingData as News)?.url || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標籤（選填）</label>
                <select
                  name="tag"
                  defaultValue={(editingData as News)?.tag || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">請選擇標籤</option>
                  <option value="gov">政府新聞</option>
                  <option value="news">新聞</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容分類（選填）</label>
                <select
                  name="newsCategory"
                  defaultValue={(editingData as News)?.newsCategory || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">請選擇分類</option>
                  <option value="event-update">事件更新</option>
                  <option value="financial-support">經濟支援</option>
                  <option value="emotional-support">情緒支援</option>
                  <option value="accommodation">住宿支援</option>
                  <option value="medical-legal">醫療/法律</option>
                  <option value="reconstruction">重建資訊</option>
                  <option value="statistics">統計數據</option>
                  <option value="community-support">社區支援</option>
                  <option value="government-announcement">政府公告</option>
                  <option value="general-news">一般新聞</option>
                </select>
              </div>
            </>
          ) : collectionName === 'locations' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收集站名稱 *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={(editingData as Location)?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址 *</label>
                <input
                  name="address"
                  type="text"
                  required
                  defaultValue={(editingData as Location)?.address || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <input type="hidden" name="type" value="collection_point" />
            </>
          ) : collectionName === 'eventStats' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">事件開始日期 *</label>
                <input
                  name="eventStartDate"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingData 
                      ? new Date((editingData as EventStats).eventStartDate.toDate().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                      : ''
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">死亡人數 *</label>
                <input
                  name="casualties"
                  type="number"
                  min="0"
                  required
                  defaultValue={(editingData as EventStats)?.casualties || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">受傷人數 *</label>
                <input
                  name="injured"
                  type="number"
                  min="0"
                  required
                  defaultValue={(editingData as EventStats)?.injured || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">失蹤人數 *</label>
                <input
                  name="missing"
                  type="number"
                  min="0"
                  required
                  defaultValue={(editingData as EventStats)?.missing || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">數據來源 *</label>
                <input
                  name="source"
                  type="text"
                  required
                  defaultValue={(editingData as EventStats)?.source || ''}
                  placeholder="例如：政府新聞、手動輸入"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'reconstructionInfo' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
                <textarea
                  name="content"
                  rows={6}
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.content || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分類 *</label>
                <select
                  name="category"
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.category || 'updates'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="progress">重建進度</option>
                  <option value="timeline">時間表</option>
                  <option value="resources">資源資訊</option>
                  <option value="updates">最新更新</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">狀態 *</label>
                <select
                  name="status"
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.status || 'active'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="active">進行中</option>
                  <option value="completed">已完成</option>
                  <option value="pending">待處理</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">優先級 *</label>
                <select
                  name="priority"
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.priority || 'medium'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">來源 *</label>
                <input
                  name="source"
                  type="text"
                  required
                  defaultValue={(editingData as ReconstructionInfo)?.source || '管理員'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">連結（選填）</label>
                <input
                  name="url"
                  type="url"
                  defaultValue={(editingData as ReconstructionInfo)?.url || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'historyRecords' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as HistoryRecord)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
                <textarea
                  name="content"
                  rows={6}
                  required
                  defaultValue={(editingData as HistoryRecord)?.content || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">記錄日期 *</label>
                <input
                  name="recordDate"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingData 
                      ? new Date((editingData as HistoryRecord).date.toDate().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                      : ''
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分類 *</label>
                <select
                  name="category"
                  required
                  defaultValue={(editingData as HistoryRecord)?.category || 'news'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="milestone">重要里程碑</option>
                  <option value="news">新聞摘要</option>
                  <option value="summary">經驗總結</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">重要性 *</label>
                <select
                  name="importance"
                  required
                  defaultValue={(editingData as HistoryRecord)?.importance || 'medium'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">關鍵</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標籤（選填，用逗號分隔）</label>
                <input
                  name="tags"
                  type="text"
                  defaultValue={(editingData as HistoryRecord)?.tags?.join(', ') || ''}
                  placeholder="例如：火災, 救援, 政府"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'financialAid' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">提供機構 *</label>
                <input
                  name="provider"
                  type="text"
                  required
                  defaultValue={(editingData as FinancialAid)?.provider || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">援助項目名稱 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as FinancialAid)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金額 *</label>
                <input
                  name="amount"
                  type="text"
                  required
                  defaultValue={(editingData as FinancialAid)?.amount || ''}
                  placeholder="例如：HK$10,000 (每戶)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <MultiInputField
                label="地點（選填）"
                values={locationValues}
                onChange={setLocationValues}
                placeholder="例如：地址、電話熱線、網上服務"
                required={false}
              />
              <MultiInputField
                label="聯絡方式（選填）"
                values={contactValues}
                onChange={setContactValues}
                placeholder="例如：電話、IG: @username、Email、WhatsApp"
                required={false}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時間（選填）</label>
                <input
                  name="time"
                  type="text"
                  defaultValue={(editingData as FinancialAid)?.time || ''}
                  placeholder="例如：10:00 - 13:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申請要求（選填）</label>
                <input
                  name="requirement"
                  type="text"
                  defaultValue={(editingData as FinancialAid)?.requirement || ''}
                  placeholder="例如：身分證、住址證明"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型 *</label>
                <select
                  name="type"
                  required
                  defaultValue={(editingData as FinancialAid)?.type || 'cash'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="cash">現金</option>
                  <option value="goods">物資</option>
                  <option value="voucher">代金券</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">狀態 *</label>
                <select
                  name="status"
                  required
                  defaultValue={(editingData as FinancialAid)?.status || 'open'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="open">開放中</option>
                  <option value="limited">名額有限</option>
                  <option value="closed">已結束</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">適用對象（選填）</label>
                <select
                  name="targetGroup"
                  defaultValue={(editingData as FinancialAid)?.targetGroup || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">不指定</option>
                  <option value="affected-families">受影響家庭（特別支援）</option>
                  <option value="general-residents">一般受影響居民</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">用於區分援助項目的適用對象，方便用戶篩選</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">資料來源（選填）</label>
                <input
                  name="sourceRef"
                  type="text"
                  defaultValue={(editingData as FinancialAid)?.sourceRef || ''}
                  placeholder="例如：[cite: 146, 147]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'services' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務類別 *</label>
                <select
                  name="category"
                  required
                  defaultValue={(editingData as Service)?.category || 'medical'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="medical">醫療</option>
                  <option value="pets">寵物</option>
                  <option value="emotional">情緒支援</option>
                  <option value="funeral">殯儀</option>
                  <option value="accommodation">住宿</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務名稱 *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={(editingData as Service)?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務內容 *</label>
                <input
                  name="service"
                  type="text"
                  required
                  defaultValue={(editingData as Service)?.service || ''}
                  placeholder="例如：中醫/針灸/推拿 (免費)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">適用對象（選填）</label>
                <input
                  name="target"
                  type="text"
                  defaultValue={(editingData as Service)?.target || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地點（選填）</label>
                <input
                  name="location"
                  type="text"
                  defaultValue={(editingData as Service)?.location || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聯絡方式（選填）</label>
                <input
                  name="contact"
                  type="text"
                  defaultValue={(editingData as Service)?.contact || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">有效期至（選填）</label>
                <input
                  name="validUntil"
                  type="date"
                  defaultValue={(editingData as Service)?.validUntil || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={(editingData as Service)?.note || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">資料來源（選填）</label>
                <input
                  name="sourceRef"
                  type="text"
                  defaultValue={(editingData as Service)?.sourceRef || ''}
                  placeholder="例如：[cite: 412, 416, 422]"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'reliefServices' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務類別 *</label>
                <select
                  name="category"
                  required
                  defaultValue={(editingData as ReliefService)?.category || 'emotional'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="emotional">情緒支援</option>
                  <option value="childcare">託兒</option>
                  <option value="education">學業</option>
                  <option value="accommodation">住宿</option>
                  <option value="medical">醫療</option>
                  <option value="legal">法律</option>
                  <option value="funeral">殯儀</option>
                  <option value="pets">寵物</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務名稱 *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={(editingData as ReliefService)?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">提供機構 *</label>
                <input
                  name="provider"
                  type="text"
                  required
                  defaultValue={(editingData as ReliefService)?.provider || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服務描述 *</label>
                <textarea
                  name="description"
                  rows={3}
                  required
                  defaultValue={(editingData as ReliefService)?.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <MultiInputField
                label="聯絡方式"
                values={contactValues}
                onChange={setContactValues}
                placeholder="例如：電話、IG: @username、Email、WhatsApp"
                required={true}
              />
              <MultiInputField
                label="地點"
                values={locationValues}
                onChange={setLocationValues}
                placeholder="例如：地址、電話熱線、網上服務"
                required={true}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開放時間（選填）</label>
                <input
                  name="openingHours"
                  type="text"
                  defaultValue={(editingData as ReliefService)?.openingHours || ''}
                  placeholder="例如：10:00 - 22:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={(editingData as ReliefService)?.note || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">資料來源（選填）</label>
                <input
                  name="source_ref"
                  type="text"
                  defaultValue={(editingData as ReliefService)?.source_ref || ''}
                  placeholder="例如：PDF P.35"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序順序（選填）</label>
                <input
                  name="order"
                  type="number"
                  defaultValue={(editingData as ReliefService)?.order || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : null}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '處理中...' : editingId ? '更新' : '新增'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// List Item Components
function AnnouncementItem({
  item,
  onEdit,
  onDelete,
}: {
  item: Announcement
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{item.source}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            title="編輯"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-gray-700 text-sm">{item.content}</p>
    </div>
  )
}

function NewsItem({
  item,
  onEdit,
  onDelete,
  onReclassify,
}: {
  item: News
  onEdit: () => void
  onDelete: () => void
  onReclassify: () => void
}) {
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

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{item.source}</p>
          <div className="flex items-center gap-2 mt-2">
            {item.tag && (
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                item.tag === 'gov'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-white'
              }`}>
                {item.tag === 'gov' ? '政府新聞' : '新聞'}
              </span>
            )}
            {item.newsCategory && getCategoryLabel(item.newsCategory) && (
              <span className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded">
                {getCategoryLabel(item.newsCategory)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReclassify}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded"
            title="重新分類"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            title="編輯"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-gray-700 text-sm">{item.content}</p>
    </div>
  )
}

function LocationItem({
  item,
  onEdit,
  onDelete,
}: {
  item: Location
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{item.address}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
            收集站
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            title="編輯"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
