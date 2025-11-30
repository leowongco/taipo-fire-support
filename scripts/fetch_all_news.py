#!/usr/bin/env python3
"""
統一執行所有新聞獲取腳本
"""

import sys
from fetch_gov_news import fetch_and_add_gov_news
from fetch_rthk_news import fetch_and_add_rthk_news


def main():
    """執行所有新聞獲取任務"""
    results = []
    
    # 獲取政府新聞
    print("=" * 60)
    print("開始獲取政府新聞...")
    print("=" * 60)
    try:
        gov_result = fetch_and_add_gov_news()
        results.append(('政府新聞', gov_result))
    except Exception as e:
        print(f"❌ 獲取政府新聞失敗: {str(e)}")
        results.append(('政府新聞', {'success': False, 'error': str(e)}))
    
    print("\n")
    
    # 獲取 RTHK 新聞
    print("=" * 60)
    print("開始獲取 RTHK 新聞...")
    print("=" * 60)
    try:
        rthk_result = fetch_and_add_rthk_news()
        results.append(('RTHK 新聞', rthk_result))
    except Exception as e:
        print(f"❌ 獲取 RTHK 新聞失敗: {str(e)}")
        results.append(('RTHK 新聞', {'success': False, 'error': str(e)}))
    
    # 輸出總結
    print("\n" + "=" * 60)
    print("執行總結")
    print("=" * 60)
    for name, result in results:
        if result.get('success'):
            print(f"✅ {name}: {result.get('message', '成功')}")
        else:
            print(f"❌ {name}: {result.get('error', '失敗')}")
    
    # 如果有失敗的任務，返回錯誤碼
    if any(not r.get('success', False) for _, r in results):
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()

