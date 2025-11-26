export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-sm text-gray-600 space-y-2">
          <p className="font-semibold text-gray-900">緊急聯絡</p>
          <p>緊急求助：<a href="tel:999" className="text-red-600 font-medium">999</a></p>
          <p className="mt-4 text-xs text-gray-500">
            免責聲明：本平台僅提供信息聚合服務，所有信息來源於公開渠道。
            請以官方發布的信息為準。如有緊急情況，請立即撥打 999。
          </p>
        </div>
      </div>
    </footer>
  )
}

