import { Phone, MapPin, Building2, Heart, Battery, Users, Church, Hospital, Shield, MessageCircle } from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'
import { SupportItem, SupportSection } from '../../types'
import SkeletonLoader from '../ui/SkeletonLoader'

const iconMap = {
  phone: Phone,
  building: Building2,
  shield: Shield,
  users: Users,
  church: Church,
  hospital: Hospital,
  heart: Heart,
  battery: Battery,
  message: MessageCircle,
}

export default function SupportInfo() {
  const { data: sections, loading: sectionsLoading } = useFirestore<SupportSection>('supportSections')
  const { data: items, loading: itemsLoading } = useFirestore<SupportItem>('supportItems')

  const loading = sectionsLoading || itemsLoading

  // 按 order 排序 sections
  const sortedSections = [...sections].sort((a, b) => a.order - b.order)

  // 將 items 按 sectionId 分組，並按 order 排序
  const itemsBySection = sortedSections.reduce((acc, section) => {
    acc[section.id] = items
      .filter(item => item.sectionId === section.id)
      .sort((a, b) => a.order - b.order)
    return acc
  }, {} as Record<string, SupportItem[]>)

  // 如果沒有資料，顯示空狀態
  if (!loading && sortedSections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>暫無支援資訊</p>
      </div>
    )
  }

  if (loading) {
    return <SkeletonLoader />
  }

  const renderPhone = (phone: string | string[]) => {
    if (Array.isArray(phone)) {
      return phone.map((p, idx) => (
        <div key={idx} className="flex items-center gap-2 text-gray-700">
          <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm">{p}</span>
        </div>
      ))
    }
    return (
      <div className="flex items-center gap-2 text-gray-700">
        <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <a href={`tel:${phone}`} className="text-sm hover:text-red-600 transition-colors">
          {phone}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sortedSections.map((section) => {
        const IconComponent = iconMap[section.iconType]
        const sectionItems = itemsBySection[section.id] || []
        
        if (sectionItems.length === 0) {
          return null
        }

        return (
          <div key={section.id} className="bg-white rounded-lg border border-gray-300 p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
              <div className="text-red-600">
                <IconComponent className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
            </div>
            
            <div className="space-y-4">
              {sectionItems.map((item, itemIdx) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    itemIdx < sectionItems.length - 1 ? 'border-gray-200 mb-4' : 'border-transparent'
                  }`}
                >
                  <h3 className="font-medium text-gray-900 mb-2">{item.name}</h3>
                  
                  <div className="space-y-2">
                    {item.address && (
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0" />
                        <span className="text-sm">{item.address}</span>
                      </div>
                    )}
                    
                    {item.phone && renderPhone(item.phone)}
                    
                    {item.contact && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">聯絡人：</span>
                        <span>{item.contact}</span>
                      </div>
                    )}
                    
                    {item.note && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                        {item.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      
      <div className="text-xs text-gray-500 text-center py-4">
        （以上資訊統合民間資料）
      </div>
    </div>
  )
}
