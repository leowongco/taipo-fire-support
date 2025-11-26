interface StatusBadgeProps {
  status: 'open' | 'closed' | 'full'
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    open: {
      label: '開放',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    full: {
      label: '已滿',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    closed: {
      label: '已關閉',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}

