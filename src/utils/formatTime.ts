import { Timestamp } from 'firebase/firestore'

export function formatTime(timestamp: Timestamp): string {
  const now = new Date()
  const time = timestamp.toDate()
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return '剛剛'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} 分鐘前`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} 小時前`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} 天前`
  }

  return time.toLocaleDateString('zh-Hant', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

