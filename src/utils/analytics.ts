/**
 * Google Analytics 4 (GA-4) 追蹤工具
 */

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'set' | 'js',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
    dataLayer: any[]
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

/**
 * 初始化 Google Analytics
 */
export function initGA() {
  if (!GA_MEASUREMENT_ID) {
    console.warn('⚠️ GA-4 Measurement ID 未設置，跳過 Google Analytics 初始化')
    console.warn('   請在 .env 文件中設置 VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX')
    console.warn('   然後重新構建和部署網站')
    return
  }

  // 驗證 Measurement ID 格式
  if (!GA_MEASUREMENT_ID.startsWith('G-')) {
    console.error('❌ GA-4 Measurement ID 格式錯誤，應以 "G-" 開頭')
    console.error(`   當前值: ${GA_MEASUREMENT_ID}`)
    return
  }

  try {
    // 創建 dataLayer
    window.dataLayer = window.dataLayer || []
    window.gtag = function() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: window.location.pathname,
      send_page_view: true,
    })

    // 加載 GA-4 腳本
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    
    // 添加錯誤處理
    script.onerror = () => {
      console.warn('⚠️ 無法加載 Google Analytics 腳本')
      console.warn('   可能原因：')
      console.warn('   1. 廣告攔截器阻止了 GA 腳本')
      console.warn('   2. Measurement ID 不正確')
      console.warn('   3. 網絡連接問題')
      console.warn('   網站功能不受影響，只是無法追蹤數據')
    }
    
    script.onload = () => {
      console.log('✅ Google Analytics 4 已初始化')
      console.log(`   Measurement ID: ${GA_MEASUREMENT_ID}`)
      
      // 發送測試事件以驗證 GA 是否正常工作
      setTimeout(() => {
        if (window.gtag) {
          window.gtag('event', 'ga_initialized', {
            event_category: 'system',
            event_label: 'GA4 initialized successfully',
          })
          console.log('✅ 已發送 GA 初始化測試事件')
        }
      }, 1000)
    }
    
    document.head.appendChild(script)
  } catch (error: any) {
    console.error('❌ Google Analytics 初始化失敗:', error.message)
  }
}

/**
 * 追蹤頁面瀏覽
 */
export function trackPageView(path: string, title?: string) {
  if (!GA_MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.debug('⚠️ GA 未初始化，跳過頁面追蹤:', path)
    }
    return
  }

  if (!window.gtag) {
    console.warn('⚠️ gtag 函數未定義，GA 可能尚未加載完成')
    return
  }

  try {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: title || document.title,
    })
    
    if (import.meta.env.DEV) {
      console.debug('📊 GA 頁面追蹤:', path, title || document.title)
    }
  } catch (error: any) {
    console.error('❌ 頁面追蹤失敗:', error.message)
  }
}

/**
 * 追蹤自定義事件
 */
export function trackEvent(
  eventName: string,
  eventParams?: {
    category?: string
    label?: string
    value?: number
    [key: string]: any
  }
) {
  if (!GA_MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.debug('⚠️ GA 未初始化，跳過事件追蹤:', eventName)
    }
    return
  }

  if (!window.gtag) {
    console.warn('⚠️ gtag 函數未定義，GA 可能尚未加載完成')
    return
  }

  try {
    window.gtag('event', eventName, {
      ...eventParams,
    })
    
    if (import.meta.env.DEV) {
      console.debug('📊 GA 事件追蹤:', eventName, eventParams)
    }
  } catch (error: any) {
    console.error('❌ 事件追蹤失敗:', error.message)
  }
}

/**
 * 追蹤搜索事件
 */
export function trackSearch(searchTerm: string, category?: string) {
  trackEvent('search', {
    search_term: searchTerm,
    category: category || 'all',
  })
}

/**
 * 追蹤鏈接點擊
 */
export function trackLinkClick(
  linkText: string,
  linkUrl: string,
  linkType: 'phone' | 'whatsapp' | 'email' | 'map' | 'instagram' | 'external' | 'internal'
) {
  trackEvent('click', {
    event_category: 'link',
    event_label: linkText,
    link_url: linkUrl,
    link_type: linkType,
  })
}

/**
 * 追蹤分類過濾
 */
export function trackCategoryFilter(category: string, page: string) {
  trackEvent('filter', {
    event_category: 'category',
    filter_value: category,
    page: page,
  })
}

/**
 * 追蹤服務查看
 */
export function trackServiceView(serviceName: string, category: string, provider: string) {
  trackEvent('view_item', {
    item_name: serviceName,
    item_category: category,
    item_brand: provider,
  })
}

/**
 * 追蹤表單提交
 */
export function trackFormSubmit(formName: string, success: boolean) {
  trackEvent(success ? 'form_submit_success' : 'form_submit_error', {
    form_name: formName,
  })
}

/**
 * 追蹤錯誤
 */
export function trackError(errorMessage: string, errorLocation: string) {
  trackEvent('exception', {
    description: errorMessage,
    fatal: false,
    error_location: errorLocation,
  })
}

