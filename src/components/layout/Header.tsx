import { Flame, Home, Building2, Clock, DollarSign, Heart, ExternalLink, Newspaper } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative">
              <Flame className="w-8 h-8 text-red-600" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">大埔火災支援平台</h1>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                即時更新
              </p>
            </div>
          </Link>
        </div>
        
        {/* 導航菜單 */}
        <nav className="flex gap-2 flex-wrap">
          <Link
            to="/"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Home className="w-4 h-4" />
            首頁
          </Link>
          <Link
            to="/news"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/news')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            新聞
          </Link>
          <Link
            to="/financial-aid"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/financial-aid')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            經濟援助
          </Link>
          <Link
            to="/more-support"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/more-support') || isActive('/services') || isActive('/support-resources')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Heart className="w-4 h-4" />
            支援服務
          </Link>
          <Link
            to="/history"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/history')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            歷史記錄
          </Link>
          <Link
            to="/reconstruction"
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              isActive('/reconstruction')
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            重建資訊
          </Link>
          <a
            href="https://www.taipofire.gov.hk/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            <ExternalLink className="w-4 h-4" />
            政府官方支援網頁
          </a>
        </nav>
      </div>
    </header>
  )
}

