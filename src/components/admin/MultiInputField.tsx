import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'

interface MultiInputFieldProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  required?: boolean
}

/**
 * 多項輸入組件 - 用於管理多個地址、電話或社交網絡連結
 */
export default function MultiInputField({
  label,
  values,
  onChange,
  placeholder = '輸入內容...',
  required = false,
}: MultiInputFieldProps) {
  const [items, setItems] = useState<string[]>(values.length > 0 ? values : [''])

  useEffect(() => {
    // 當外部 values 改變時更新內部狀態（例如編輯時載入數據）
    if (values.length > 0) {
      setItems(values)
    } else if (items.length === 0 || (items.length === 1 && items[0] === '')) {
      setItems([''])
    }
  }, [values])

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    setItems(newItems)
    // 過濾掉空值後通知父組件
    onChange(newItems.filter(item => item.trim() !== ''))
  }

  const handleAddItem = () => {
    setItems([...items, ''])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
      onChange(newItems.filter(item => item.trim() !== ''))
    } else {
      // 如果只有一個項目，清空它而不是刪除
      setItems([''])
      onChange([])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              placeholder={placeholder}
              required={required && index === 0}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveItem(index)}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="刪除此項"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddItem}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
        >
          <Plus className="w-4 h-4" />
          添加更多
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">可以添加多個項目，例如：多個地址、多個電話號碼或多個社交網絡連結</p>
    </div>
  )
}

