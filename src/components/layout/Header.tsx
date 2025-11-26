import { Flame } from 'lucide-react'

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>
    </header>
  )
}

