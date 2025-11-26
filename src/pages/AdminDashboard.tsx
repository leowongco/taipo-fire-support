import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, onAuthStateChanged, User } from 'firebase/auth'
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import Layout from '../components/layout/Layout'
import { useFirestore } from '../hooks/useFirestore'
import { Announcement, Resource, SupportSection, SupportItem } from '../types'
import { LogOut, Plus, Edit, Trash2, X, User as UserIcon } from 'lucide-react'

type CollectionType = 'announcements' | 'resources' | 'shelters' | 'supportSections' | 'supportItems'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<CollectionType>('announcements')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const navigate = useNavigate()

  const { data: announcements } = useFirestore<Announcement>('announcements')
  const { data: resources } = useFirestore<Resource>('resources')
  const { data: supportSections } = useFirestore<SupportSection>('supportSections')
  const { data: supportItems } = useFirestore<SupportItem>('supportItems')

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
      // 如果刪除 section，也要刪除相關的 items
      if (collectionName === 'supportSections') {
        const relatedItems = supportItems.filter(item => item.sectionId === id)
        for (const item of relatedItems) {
          await deleteDoc(doc(db, 'supportItems', item.id))
        }
      }
    }
  }

  const handleMarkAsFull = async (id: string) => {
    await updateDoc(doc(db, 'resources', id), {
      status: 'full',
      updatedAt: Timestamp.now(),
    })
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
              setActiveTab('resources')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'resources'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            物資收集站管理
          </button>
          <button
            onClick={() => {
              setActiveTab('shelters')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'shelters'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            庇護中心管理
          </button>
          <button
            onClick={() => {
              setActiveTab('supportSections')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'supportSections'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            支援類別管理
          </button>
          <button
            onClick={() => {
              setActiveTab('supportItems')
              setShowForm(false)
              setEditingId(null)
            }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'supportItems'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            支援項目管理
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
          新增{activeTab === 'announcements' ? '公告' : activeTab === 'resources' ? '物資收集站' : activeTab === 'shelters' ? '庇護中心' : activeTab === 'supportSections' ? '支援類別' : '支援項目'}
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
                : activeTab === 'resources' || activeTab === 'shelters'
                ? resources.find((r) => r.id === editingId)
                : activeTab === 'supportSections'
                ? supportSections.find((s) => s.id === editingId)
                : supportItems.find((i) => i.id === editingId)
              : null
          }
          supportSections={supportSections}
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
        ) : activeTab === 'resources' ? (
          <>
            {resources.filter(r => r.category === 'supply').length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無物資收集站</p>
            ) : (
              resources
                .filter(r => r.category === 'supply')
                .map((item) => (
                  <ResourceItem
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditingId(item.id)
                      setShowForm(true)
                    }}
                    onDelete={() => handleDelete('resources', item.id)}
                    onMarkAsFull={() => handleMarkAsFull(item.id)}
                  />
                ))
            )}
          </>
        ) : activeTab === 'shelters' ? (
          <>
            {resources.filter(r => r.category === 'shelter').length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無庇護中心</p>
            ) : (
              resources
                .filter(r => r.category === 'shelter')
                .map((item) => (
                  <ResourceItem
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditingId(item.id)
                      setShowForm(true)
                    }}
                    onDelete={() => handleDelete('resources', item.id)}
                    onMarkAsFull={() => handleMarkAsFull(item.id)}
                  />
                ))
            )}
          </>
        ) : activeTab === 'supportSections' ? (
          <>
            {supportSections.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無支援類別</p>
            ) : (
              supportSections.sort((a, b) => a.order - b.order).map((item) => (
                <SupportSectionItem
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditingId(item.id)
                    setShowForm(true)
                  }}
                  onDelete={() => handleDelete('supportSections', item.id)}
                />
              ))
            )}
          </>
        ) : (
          <>
            {supportItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暫無支援項目</p>
            ) : (
              supportItems
                .sort((a, b) => {
                  // 先按 section 排序，再按 order 排序
                  const sectionA = supportSections.find(s => s.id === a.sectionId)
                  const sectionB = supportSections.find(s => s.id === b.sectionId)
                  if (sectionA && sectionB) {
                    if (sectionA.order !== sectionB.order) {
                      return sectionA.order - sectionB.order
                    }
                  }
                  return a.order - b.order
                })
                .map((item) => {
                  const section = supportSections.find(s => s.id === item.sectionId)
                  return (
                    <SupportItemComponent
                      key={item.id}
                      item={item}
                      sectionTitle={section?.title || '未知類別'}
                      onEdit={() => {
                        setEditingId(item.id)
                        setShowForm(true)
                      }}
                      onDelete={() => handleDelete('supportItems', item.id)}
                    />
                  )
                })
            )}
          </>
        )}
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
  supportSections = [],
}: {
  collectionName: CollectionType
  editingId: string | null
  editingData: Announcement | Resource | SupportSection | SupportItem | null | undefined
  onClose: () => void
  supportSections?: SupportSection[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
          isUrgent: data.isUrgent === 'on',
          // 如果標記為緊急，自動設置標籤為 urgent；否則使用選擇的標籤
          tag: (data.isUrgent === 'on' ? 'urgent' : (data.tag as 'urgent' | 'gov' | 'news' | '') || undefined),
          timestamp: editingId ? (editingData as Announcement)?.timestamp : Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'announcements', editingId), announcementData)
        } else {
          await addDoc(collection(db, 'announcements'), announcementData)
        }
      } else if (collectionName === 'resources' || collectionName === 'shelters') {
        const resourceData = {
          locationName: data.locationName as string,
          address: data.address as string,
          mapLink: data.mapLink as string,
          status: data.status as 'open' | 'closed' | 'full',
          // 物資收集站管理自動設置為 'supply'，庇護中心管理自動設置為 'shelter'
          category: (collectionName === 'shelters' ? 'shelter' : 'supply') as 'supply' | 'shelter',
          needs: (data.needs as string).split(',').map((s) => s.trim()).filter(Boolean),
          contact: data.contact as string,
          updatedAt: Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'resources', editingId), resourceData)
        } else {
          await addDoc(collection(db, 'resources'), resourceData)
        }
      } else if (collectionName === 'supportSections') {
        const sectionData = {
          title: data.title as string,
          iconType: data.iconType as SupportSection['iconType'],
          order: parseInt(data.order as string, 10),
          updatedAt: Timestamp.now(),
          createdAt: editingId ? (editingData as SupportSection)?.createdAt : Timestamp.now(),
        }

        if (editingId) {
          await updateDoc(doc(db, 'supportSections', editingId), sectionData)
        } else {
          await addDoc(collection(db, 'supportSections'), sectionData)
        }
      } else if (collectionName === 'supportItems') {
        // 構建文檔數據，只包含存在的欄位
        const itemData: any = {
          name: data.name as string,
          sectionId: data.sectionId as string,
          order: parseInt(data.order as string, 10),
          updatedAt: Timestamp.now(),
        }
        
        // 只在值存在時添加可選欄位
        if (data.address && (data.address as string).trim()) {
          itemData.address = (data.address as string).trim()
        }
        if (data.phone && (data.phone as string).trim()) {
          const phoneValue = (data.phone as string).trim()
          itemData.phone = phoneValue.includes(',') 
            ? phoneValue.split(',').map(s => s.trim()).filter(Boolean)
            : phoneValue
        }
        if (data.contact && (data.contact as string).trim()) {
          itemData.contact = (data.contact as string).trim()
        }
        if (data.note && (data.note as string).trim()) {
          itemData.note = (data.note as string).trim()
        }
        
        // 只在新增時添加 createdAt
        if (!editingId) {
          itemData.createdAt = Timestamp.now()
        } else {
          // 編輯時保留原有的 createdAt
          const existingCreatedAt = (editingData as SupportItem)?.createdAt
          if (existingCreatedAt) {
            itemData.createdAt = existingCreatedAt
          }
        }

        if (editingId) {
          await updateDoc(doc(db, 'supportItems', editingId), itemData)
        } else {
          await addDoc(collection(db, 'supportItems'), itemData)
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
              : collectionName === 'resources' ? '物資收集站'
              : collectionName === 'shelters' ? '庇護中心'
              : collectionName === 'supportSections' ? '支援類別'
              : '支援項目'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標籤 *</label>
                <select
                  name="tag"
                  required
                  defaultValue={(editingData as Announcement)?.tag || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">請選擇標籤</option>
                  <option value="urgent">緊急</option>
                  <option value="gov">政府新聞</option>
                  <option value="news">新聞</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  name="isUrgent"
                  type="checkbox"
                  defaultChecked={(editingData as Announcement)?.isUrgent || false}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-600"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">標記為緊急（同時會自動設置為緊急標籤）</label>
              </div>
            </>
          ) : collectionName === 'resources' || collectionName === 'shelters' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地點名稱 *</label>
                <input
                  name="locationName"
                  type="text"
                  required
                  defaultValue={(editingData as Resource)?.locationName || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址 *</label>
                <input
                  name="address"
                  type="text"
                  required
                  defaultValue={(editingData as Resource)?.address || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地圖連結 *</label>
                <input
                  name="mapLink"
                  type="url"
                  required
                  defaultValue={(editingData as Resource)?.mapLink || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              {collectionName === 'resources' && (
                <input type="hidden" name="category" value="supply" />
              )}
              {collectionName === 'shelters' && (
                <input type="hidden" name="category" value="shelter" />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">狀態 *</label>
                <select
                  name="status"
                  required
                  defaultValue={(editingData as Resource)?.status || 'open'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="open">開放</option>
                  <option value="full">已滿</option>
                  <option value="closed">已關閉</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">需要物資（用逗號分隔）</label>
                <input
                  name="needs"
                  type="text"
                  defaultValue={(editingData as Resource)?.needs?.join(', ') || ''}
                  placeholder="例如：水, 毛巾, 食物"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聯絡方式</label>
                <input
                  name="contact"
                  type="text"
                  defaultValue={(editingData as Resource)?.contact || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : collectionName === 'supportSections' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類別名稱 *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={(editingData as SupportSection)?.title || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">圖標類型 *</label>
                <select
                  name="iconType"
                  required
                  defaultValue={(editingData as SupportSection)?.iconType || 'phone'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="phone">電話</option>
                  <option value="building">建築</option>
                  <option value="shield">盾牌</option>
                  <option value="users">用戶</option>
                  <option value="church">教會</option>
                  <option value="hospital">醫院</option>
                  <option value="heart">愛心</option>
                  <option value="battery">電池</option>
                  <option value="message">訊息</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序順序 *</label>
                <input
                  name="order"
                  type="number"
                  required
                  min="0"
                  defaultValue={(editingData as SupportSection)?.order ?? 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所屬類別 *</label>
                <select
                  name="sectionId"
                  required
                  defaultValue={(editingData as SupportItem)?.sectionId || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">請選擇類別</option>
                  {supportSections.sort((a, b) => a.order - b.order).map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">項目名稱 *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={(editingData as SupportItem)?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址（選填）</label>
                <input
                  name="address"
                  type="text"
                  defaultValue={(editingData as SupportItem)?.address || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話（選填，多個用逗號分隔）</label>
                <input
                  name="phone"
                  type="text"
                  defaultValue={(() => {
                    const phone = (editingData as SupportItem)?.phone
                    if (!phone) return ''
                    if (Array.isArray(phone)) {
                      return phone.join(', ')
                    }
                    if (typeof phone === 'string') {
                      return phone
                    }
                    return ''
                  })()}
                  placeholder="例如：1234 5678 或 1234 5678, 9876 5432"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聯絡人（選填）</label>
                <input
                  name="contact"
                  type="text"
                  defaultValue={(editingData as SupportItem)?.contact || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={(editingData as SupportItem)?.note || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序順序 *</label>
                <input
                  name="order"
                  type="number"
                  required
                  min="0"
                  defaultValue={(editingData as SupportItem)?.order ?? 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
            </>
          )}

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

function SupportSectionItem({
  item,
  onEdit,
  onDelete,
}: {
  item: SupportSection
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-sm text-gray-600 mt-1">圖標：{item.iconType} | 排序：{item.order}</p>
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

function SupportItemComponent({
  item,
  sectionTitle,
  onEdit,
  onDelete,
}: {
  item: SupportItem
  sectionTitle: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{item.name}</h3>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
              {sectionTitle}
            </span>
          </div>
          {item.address && (
            <p className="text-sm text-gray-600 mt-1">{item.address}</p>
          )}
          {item.phone && (
            <p className="text-sm text-gray-600 mt-1">
              電話：{Array.isArray(item.phone) ? item.phone.join(', ') : item.phone}
            </p>
          )}
          {item.contact && (
            <p className="text-sm text-gray-600 mt-1">聯絡人：{item.contact}</p>
          )}
          {item.note && (
            <p className="text-sm text-gray-600 mt-1">{item.note}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">排序：{item.order}</p>
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
      <div className="flex items-center gap-2 mt-2">
        {item.tag && (
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            item.tag === 'urgent' 
              ? 'bg-red-600 text-white'
              : item.tag === 'gov'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-600 text-white'
          }`}>
            {item.tag === 'urgent' ? '緊急' : item.tag === 'gov' ? '政府新聞' : '新聞'}
          </span>
        )}
        {/* 兼容舊數據 */}
        {!item.tag && item.isUrgent && (
          <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
            緊急
          </span>
        )}
      </div>
    </div>
  )
}

function ResourceItem({
  item,
  onEdit,
  onDelete,
  onMarkAsFull,
}: {
  item: Resource
  onEdit: () => void
  onDelete: () => void
  onMarkAsFull: () => void
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.locationName}</h3>
          <p className="text-sm text-gray-600 mt-1">{item.address}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.needs.map((need, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-800 text-xs rounded">
                {need}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {item.status === 'open' && (
            <button
              onClick={onMarkAsFull}
              className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              標記為已滿
            </button>
          )}
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
      <div className="mt-2">
        <span
          className={`px-2 py-1 text-xs rounded ${
            item.status === 'open'
              ? 'bg-green-100 text-green-800'
              : item.status === 'full'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {item.status === 'open' ? '開放' : item.status === 'full' ? '已滿' : '已關閉'}
        </span>
      </div>
    </div>
  )
}

