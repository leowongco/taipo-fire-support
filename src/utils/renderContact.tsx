import { Phone, MessageCircle, ExternalLink } from 'lucide-react'
import { getTelUrl, getWhatsAppUrl, parsePhoneNumbers, isInstagramAccount, getInstagramUrl } from './formatContact'
import { trackLinkClick } from './analytics'

/**
 * 渲染聯絡方式（支持字符串或數組）
 */
export function renderContact(contact: string | string[]) {
  const contacts = Array.isArray(contact) ? contact : [contact]
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {contacts.map((contactItem, contactIdx) => {
        if (!contactItem || contactItem.trim() === '') return null
        
        // 檢查是否為 Instagram 帳號
        if (isInstagramAccount(contactItem)) {
          const igParts = contactItem.split(/[,，]/).map(p => p.trim()).filter(p => p)
          const igAccounts = igParts.filter(part => isInstagramAccount(part))
          
          if (igAccounts.length > 0) {
            return (
              <div key={contactIdx} className="flex items-center gap-2 flex-wrap">
                {contactIdx === 0 && <span className="text-sm text-gray-700">IG:</span>}
                {igAccounts.map((igPart, idx) => {
                  const igUrl = getInstagramUrl(igPart)
                  const displayText = igPart.replace(/^(ig|instagram):\s*/i, '').trim()
                  
                  if (igUrl) {
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <a
                          href={igUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackLinkClick(displayText, igUrl, 'instagram')}
                          className="text-pink-600 hover:text-pink-700 hover:underline flex items-center gap-1 font-medium"
                        >
                          {displayText}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {idx < igAccounts.length - 1 && <span className="text-gray-400">,</span>}
                      </div>
                    )
                  }
                  return <span key={idx} className="text-sm">{displayText}</span>
                })}
              </div>
            )
          }
        }
        
        // 處理 Email
        if (contactItem.includes('@') && contactItem.includes('.') && !contactItem.includes('ig:') && !contactItem.includes('instagram:')) {
          return (
            <div key={contactIdx} className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <a
                href={`mailto:${contactItem}`}
                onClick={() => trackLinkClick(contactItem, `mailto:${contactItem}`, 'email')}
                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                {contactItem}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )
        }
        
        // 處理 URL
        if (contactItem.toLowerCase().includes('http') || contactItem.toLowerCase().includes('www.')) {
          return (
            <div key={contactIdx} className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <a
                href={contactItem.startsWith('http') ? contactItem : `https://${contactItem}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLinkClick(contactItem, contactItem.startsWith('http') ? contactItem : `https://${contactItem}`, 'external')}
                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                {contactItem}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )
        }
        
        // 處理電話號碼
        const phoneNumbers = parsePhoneNumbers(contactItem)
        return (
          <div key={contactIdx} className="flex items-center gap-2 flex-wrap">
            <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
            {phoneNumbers.map((phoneInfo, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <a
                  href={getTelUrl(phoneInfo.text)}
                  onClick={() => trackLinkClick(phoneInfo.text, getTelUrl(phoneInfo.text), 'phone')}
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {phoneInfo.text}
                </a>
                {phoneInfo.isWhatsApp && (
                  <a
                    href={getWhatsAppUrl(phoneInfo.text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackLinkClick(phoneInfo.text, getWhatsAppUrl(phoneInfo.text), 'whatsapp')}
                    className="text-green-600 hover:text-green-700"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
                {idx < phoneNumbers.length - 1 && <span className="text-gray-400">/</span>}
              </div>
            ))}
            {contactIdx < contacts.length - 1 && <span className="text-gray-400 mx-1">|</span>}
          </div>
        )
      })}
    </div>
  )
}

