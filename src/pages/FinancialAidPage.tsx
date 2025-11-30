import { useState, useMemo } from 'react'
import Layout from '../components/layout/Layout'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import { useFirestore } from '../hooks/useFirestore'
import { FinancialAid } from '../types'
import { DollarSign, Clock, FileText, AlertCircle, Heart } from 'lucide-react'
import { trackEvent } from '../utils/analytics'
import { renderContact } from '../utils/renderContact'
import { renderLocation } from '../utils/renderLocation'

export default function FinancialAidPage() {
  // 使用一次性查詢而非實時監聽，減少 Firestore 讀取操作
  const { data: financialAid, loading, error } = useFirestore<FinancialAid>('financialAid', {
    realtime: false,
    limit: 100
  })
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'limited'>('all')
  const [targetGroupFilter, setTargetGroupFilter] = useState<'affected-families' | 'general-residents'>('general-residents')

  const filteredAid = useMemo(() => {
    return financialAid.filter(aid => {
      // 狀態過濾
      if (statusFilter !== 'all' && aid.status !== statusFilter) {
        return false
      }
      // 目標群組過濾
      // 如果沒有設置 targetGroup，在選擇特定過濾時不顯示
      if (!aid.targetGroup) {
        return false
      }
      // 檢查是否匹配選擇的目標群組
      if (targetGroupFilter === 'affected-families') {
        // 受影響家庭：顯示 affected-families 和 general-residents 的援助（因為有死者，可以申請更多援助）
        if (aid.targetGroup !== 'affected-families' && aid.targetGroup !== 'general-residents') {
          return false
        }
      } else if (targetGroupFilter === 'general-residents') {
        // 一般受影響居民：只顯示標記為 general-residents 的援助
        if (aid.targetGroup !== 'general-residents') {
          return false
        }
      }
      return true
    })
  }, [financialAid, statusFilter, targetGroupFilter])

  // 計算總金額（按目標群組分開計算）
  // 注意：這裡使用所有 financialAid，而不是 filteredAid，因為要顯示所有可申請的總額
  const totalAmounts = useMemo(() => {
    const openAid = financialAid.filter(aid => aid.status === 'open')
    
    const calculateAmount = (aid: FinancialAid) => {
      // 提取金額數字（例如 "HK$10,000" -> 10000）
      const amountMatch = aid.amount.match(/HK\$\s*([\d,]+)/)
      if (amountMatch) {
        const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10)
        // 如果是多項（例如 "各 HK$1,000"），假設可以申請3項
        if (aid.amount.includes('各') || aid.amount.includes('多項')) {
          return amount * 3
        }
        return amount
      }
      return 0
    }
    
    // 分別計算各類援助的總額
    const affectedFamiliesOnlyTotal = openAid
      .filter(aid => aid.targetGroup === 'affected-families')
      .reduce((sum, aid) => sum + calculateAmount(aid), 0)
    
    const generalResidentsOnlyTotal = openAid
      .filter(aid => aid.targetGroup === 'general-residents')
      .reduce((sum, aid) => sum + calculateAmount(aid), 0)
    
    // 未指定目標群組的總額
    const unspecifiedTotal = openAid
      .filter(aid => !aid.targetGroup)
      .reduce((sum, aid) => sum + calculateAmount(aid), 0)
    
    // 受影響家庭可申請的總額 = 受影響家庭援助 + 一般受影響居民援助（因為有死者，可以申請更多援助）
    const affectedFamiliesTotal = affectedFamiliesOnlyTotal + generalResidentsOnlyTotal
    
    // 一般受影響居民可申請的總額 = 僅一般受影響居民援助
    const generalResidentsTotal = generalResidentsOnlyTotal
    
    // 總計（避免重複計算）
    const grandTotal = affectedFamiliesOnlyTotal + generalResidentsOnlyTotal + unspecifiedTotal
    
    return {
      affectedFamiliesOnly: affectedFamiliesOnlyTotal,
      generalResidentsOnly: generalResidentsOnlyTotal,
      affectedFamilies: affectedFamiliesTotal,
      generalResidents: generalResidentsTotal,
      unspecified: unspecifiedTotal,
      total: grandTotal
    }
  }, [financialAid])


  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">經濟援助</h1>
        <p className="text-gray-600 text-sm">可申請的現金援助和物資支援</p>
      </div>

      {/* 總金額計算器（根據適用對象動態顯示） */}
      {!loading && !error && financialAid.filter(aid => aid.status === 'open').length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-green-900">可申請總額估算</h2>
          </div>
          
          <div className="space-y-2 mb-3">
            {targetGroupFilter === 'general-residents' ? (
              // 選擇「一般受影響居民」時：只顯示一般受影響居民可申請的總額
              totalAmounts.generalResidentsOnly > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded p-2">
                  <span className="text-sm font-medium text-indigo-900">一般受影響居民：</span>
                  <span className="text-lg font-bold text-indigo-700">
                    HK$ {totalAmounts.generalResidentsOnly.toLocaleString('zh-HK')}
                  </span>
                </div>
              )
            ) : (
              // 選擇「受影響家庭」時：第一行顯示一般受影響居民，第二行顯示受影響家庭
              <>
                {totalAmounts.generalResidentsOnly > 0 && (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded p-2">
                    <span className="text-sm font-medium text-indigo-900">一般受影響居民：</span>
                    <span className="text-lg font-bold text-indigo-700">
                      HK$ {totalAmounts.generalResidentsOnly.toLocaleString('zh-HK')}
                    </span>
                  </div>
                )}
                {totalAmounts.affectedFamiliesOnly > 0 && (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">受影響家庭：</span>
                    </div>
                    <span className="text-lg font-bold text-purple-700">
                      HK$ {totalAmounts.affectedFamiliesOnly.toLocaleString('zh-HK')}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="pt-2 border-t border-green-300">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-green-900">總計：</span>
              <span className="text-2xl font-bold text-green-700">
                HK$ {
                  targetGroupFilter === 'general-residents'
                    ? totalAmounts.generalResidentsOnly.toLocaleString('zh-HK')
                    : totalAmounts.affectedFamilies.toLocaleString('zh-HK')
                }
              </span>
            </div>
          </div>
          
          <p className="text-sm text-green-600 mt-2">
            如果申請所有開放中的援助項目，總額約為上述金額（實際金額可能因個別條件而異）
          </p>
        </div>
      )}

      {/* 過濾器 */}
      {!loading && !error && financialAid.length > 0 && (
        <div className="mb-4 space-y-4">
          {/* 狀態過濾器 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">狀態：</p>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'open', 'limited', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    trackEvent('filter', {
                      event_category: 'financial_aid_status',
                      filter_value: status,
                      page: 'financial-aid',
                    })
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '全部' : status === 'open' ? '開放中' : status === 'limited' ? '名額有限' : '已結束'}
                </button>
              ))}
            </div>
          </div>

          {/* 目標群組過濾器 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">適用對象：</p>
            <div className="flex gap-2 flex-wrap">
              {(['general-residents', 'affected-families'] as const).map((group) => (
                <button
                  key={group}
                  onClick={() => {
                    setTargetGroupFilter(group)
                    trackEvent('filter', {
                      event_category: 'financial_aid_target_group',
                      filter_value: group,
                      page: 'financial-aid',
                    })
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    targetGroupFilter === group
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {group === 'affected-families' ? (
                    <>
                      <Heart className="w-4 h-4" />
                      受影響家庭
                    </>
                  ) : (
                    <>一般受影響居民</>
                  )}
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
              <h3 className="font-medium text-yellow-800 mb-1">無法載入經濟援助資料</h3>
              <p className="text-sm text-yellow-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 援助列表 */}
      <div className="space-y-4">
        {loading ? (
          <SkeletonLoader />
        ) : filteredAid.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>暫無經濟援助資料</p>
          </div>
        ) : (
          filteredAid.map((aid) => (
            <div key={aid.id} className="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{aid.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{aid.provider}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      aid.status === 'open' ? 'bg-green-100 text-green-800' :
                      aid.status === 'limited' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {aid.status === 'open' ? '開放中' : aid.status === 'limited' ? '名額有限' : '已結束'}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {aid.type === 'cash' ? '現金' : aid.type === 'goods' ? '物資' : '代金券'}
                    </span>
                    {aid.targetGroup === 'affected-families' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        受影響家庭
                      </span>
                    )}
                    {aid.targetGroup === 'general-residents' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        一般受影響居民
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">{aid.amount}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                {/* 渲染地點（支持多個） */}
                {aid.location && (Array.isArray(aid.location) ? aid.location.length > 0 : aid.location.trim() !== '') && (
                  renderLocation(aid.location)
                )}
                
                {/* 渲染聯絡方式（支持多個） */}
                {aid.contact && (Array.isArray(aid.contact) ? aid.contact.length > 0 : aid.contact.trim() !== '') && (
                  renderContact(aid.contact)
                )}
                {aid.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span>{aid.time}</span>
                  </div>
                )}
                {aid.requirement && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                    <span>需要：{aid.requirement}</span>
                  </div>
                )}
              </div>

              {aid.sourceRef && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">資料來源：救災資訊小冊子 v1.3 {aid.sourceRef}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}

