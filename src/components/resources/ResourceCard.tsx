import { Resource } from '../../types'
import { formatTime } from '../../utils/formatTime'
import StatusBadge from '../ui/StatusBadge'
import { MapPin, Phone } from 'lucide-react'

interface ResourceCardProps {
  resource: Resource
}

export default function ResourceCard({ resource }: ResourceCardProps) {
  const categoryLabel = resource.category === 'supply' ? '物資收集站' : '庇護中心'
  const categoryColor = resource.category === 'supply' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-purple-100 text-purple-800 border-purple-300'

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg text-gray-900">{resource.locationName}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColor}`}>
              {categoryLabel}
            </span>
          </div>
        </div>
        <StatusBadge status={resource.status} />
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2 text-gray-700">
          <MapPin className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0" />
          <span className="text-sm">{resource.address}</span>
        </div>
        
        {resource.contact && (
          <div className="flex items-center gap-2 text-gray-700">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{resource.contact}</span>
          </div>
        )}
      </div>

      {resource.needs && resource.needs.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">需要物資：</p>
          <div className="flex flex-wrap gap-2">
            {resource.needs.map((need, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-800 text-xs rounded border border-blue-200"
              >
                {need}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          更新於 {formatTime(resource.updatedAt)}
        </span>
        <a
          href={resource.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          開啟地圖
        </a>
      </div>
    </div>
  )
}

