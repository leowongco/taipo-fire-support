import { Timestamp } from 'firebase/firestore'

/**
 * 計算事件發生到現在的時間差
 * @param eventStartDate 事件開始時間
 * @returns 包含天數、小時數、分鐘數的對象
 */
export function calculateEventDuration(eventStartDate: Timestamp | Date): {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalHours: number
  totalSeconds: number
  formatted: string
  formattedWithSeconds: string
} {
  const startDate = eventStartDate instanceof Timestamp 
    ? eventStartDate.toDate() 
    : eventStartDate
  const now = new Date()
  const diffMs = now.getTime() - startDate.getTime()
  
  const totalSeconds = Math.floor(diffMs / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = totalMinutes % 60
  const seconds = totalSeconds % 60
  
  // 格式化顯示（不含秒數）
  let formatted = ''
  if (days > 0) {
    formatted = `${days} 天`
    if (hours > 0) {
      formatted += ` ${hours} 小時`
    }
    if (minutes > 0) {
      formatted += ` ${minutes} 分鐘`
    }
  } else if (hours > 0) {
    formatted = `${hours} 小時`
    if (minutes > 0) {
      formatted += ` ${minutes} 分鐘`
    }
  } else if (minutes > 0) {
    formatted = `${minutes} 分鐘`
    if (seconds > 0) {
      formatted += ` ${seconds} 秒`
    }
  } else {
    formatted = `${seconds} 秒`
  }
  
  // 格式化顯示（含秒數，精確顯示）
  let formattedWithSeconds = ''
  if (days > 0) {
    formattedWithSeconds = `${days} 天 ${hours} 小時 ${minutes} 分鐘 ${seconds} 秒`
  } else if (hours > 0) {
    formattedWithSeconds = `${hours} 小時 ${minutes} 分鐘 ${seconds} 秒`
  } else if (minutes > 0) {
    formattedWithSeconds = `${minutes} 分鐘 ${seconds} 秒`
  } else {
    formattedWithSeconds = `${seconds} 秒`
  }
  
  return {
    days,
    hours,
    minutes,
    seconds,
    totalHours,
    totalSeconds,
    formatted,
    formattedWithSeconds
  }
}

