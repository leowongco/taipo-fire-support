import { MapPin, ExternalLink } from 'lucide-react'
import { getGoogleMapsUrl } from './formatContact'
import { trackLinkClick } from './analytics'

/**
 * 渲染地點（支持字符串或數組）
 */
export function renderLocation(location: string | string[]) {
  const locations = Array.isArray(location) ? location : [location]
  
  return (
    <div className="space-y-2">
      {locations.map((loc, idx) => {
        if (!loc || loc.trim() === '' || loc === '-') return null
        
        const isLinkable = loc !== '電話熱線' && 
                          loc !== '網上服務' && 
                          loc !== '電話/網上' && 
                          !loc.startsWith('http') &&
                          !loc.startsWith('IG:') &&
                          !loc.startsWith('ig:')
        
        if (isLinkable) {
          return (
            <div key={idx} className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <a
                href={getGoogleMapsUrl(loc)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLinkClick(loc, getGoogleMapsUrl(loc), 'map')}
                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                {loc}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )
        } else if (loc.startsWith('http')) {
          return (
            <div key={idx} className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <a
                href={loc}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLinkClick(loc, loc, 'external')}
                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                {loc}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )
        } else {
          return (
            <div key={idx} className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <span>{loc}</span>
            </div>
          )
        }
      })}
    </div>
  )
}

