#!/usr/bin/env python3
"""
政府新聞公報獲取器 (Python 版本)
"""

import os
import sys
import re
import time
from datetime import datetime
from typing import List, Dict, Optional
import feedparser
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# 載入環境變量
load_dotenv()

# 初始化 Firebase
if not firebase_admin._apps:
    # 嘗試使用環境變量中的服務帳戶
    cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        # 嘗試使用項目根目錄的服務帳戶文件
        default_cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'service-account-key.json')
        if os.path.exists(default_cred_path):
            cred = credentials.Certificate(default_cred_path)
            firebase_admin.initialize_app(cred)
        else:
            try:
                # 使用默認憑證（適用於 Cloud Functions 或已設置的環境）
                firebase_admin.initialize_app()
            except Exception as e:
                print("❌ Firebase 初始化失敗！")
                print("\n請設置 Firebase 憑證，方法如下：")
                print("1. 下載服務帳戶密鑰文件（JSON）")
                print("2. 設置環境變量：")
                print("   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json")
                print("   或將文件放在項目根目錄並命名為 'service-account-key.json'")
                print("\n詳細說明：https://cloud.google.com/docs/authentication/external/set-up-adc")
                raise

db = firestore.client()

# 火災相關關鍵詞（核心關鍵詞，必須包含）
CORE_FIRE_KEYWORDS = [
    "火",
    "火警",
    "火災",
    "火災事故",
    "火災現場",
    "宏福苑",  # 特定地點
]

# 輔助關鍵詞
SUPPORTING_KEYWORDS = [
    "大埔",
    "宏福",
    "庇護中心",
    "臨時庇護",
    "疏散",
    "消防",
    "救援",
    "緊急",
    "撤離",
]


def is_fire_related(text: str) -> bool:
    """檢查文本是否與火災相關"""
    if not text or not text.strip():
        return False
    
    lower_text = text.lower()
    
    # 必須包含至少一個核心關鍵詞
    has_core_keyword = any(
        keyword.lower() in lower_text for keyword in CORE_FIRE_KEYWORDS
    )
    
    if has_core_keyword:
        return True
    
    # 如果沒有核心關鍵詞，檢查是否同時包含多個輔助關鍵詞
    supporting_count = sum(
        1 for keyword in SUPPORTING_KEYWORDS
        if keyword.lower() in lower_text
    )
    
    # 如果包含 2 個或以上的輔助關鍵詞，且包含"大埔"或"宏福"，則認為相關
    if supporting_count >= 2:
        return "大埔" in lower_text or "宏福" in lower_text
    
    return False


def parse_rss_date(pub_date) -> str:
    """解析 RSS pubDate 為中文日期格式"""
    try:
        # feedparser 會自動解析日期為 time.struct_time
        if hasattr(pub_date, 'tm_year'):
            return f"{pub_date.tm_year}年{pub_date.tm_mon}月{pub_date.tm_mday}日"
        elif isinstance(pub_date, str):
            # 如果是字符串，嘗試解析
            dt = datetime.strptime(pub_date[:19], "%Y-%m-%dT%H:%M:%S")
            return f"{dt.year}年{dt.month}月{dt.day}日"
    except:
        pass
    return datetime.now().strftime("%Y年%m月%d日")


def clean_html(html: str) -> str:
    """清理 HTML 標籤和實體"""
    if not html:
        return ""
    
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text()
    
    # 清理多餘空格
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def fetch_gov_news() -> List[Dict[str, str]]:
    """獲取政府新聞公報（使用 RSS Feed）"""
    rss_url = "https://www.info.gov.hk/gia/rss/general_zh.xml"
    
    try:
        print(f"📰 正在從 RSS Feed 獲取政府新聞: {rss_url}")
        
        feed = feedparser.parse(rss_url)
        
        if feed.bozo:
            print(f"⚠️  RSS 解析警告: {feed.bozo_exception}")
        
        news_items = []
        
        for entry in feed.entries:
            title = entry.get('title', '').strip()
            link = entry.get('link', '').strip()
            description = entry.get('description', '').strip()
            pub_date = entry.get('published', '')
            
            if not title or not link:
                continue
            
            # 檢查是否與火災相關
            title_related = is_fire_related(title)
            desc_related = is_fire_related(description)
            
            if title_related or desc_related:
                # 使用 published_parsed（feedparser 解析後的日期）或 pub_date
                date_obj = entry.get('published_parsed') or pub_date
                date_str = parse_rss_date(date_obj) if date_obj else datetime.now().strftime("%Y年%m月%d日")
                news_items.append({
                    'title': title,
                    'url': link,
                    'date': date_str,
                    'description': clean_html(description)
                })
                print(f"✅ 找到相關新聞: {title}")
            else:
                print(f"⏭️  跳過不相關新聞: {title}")
        
        print(f"✅ 從 RSS Feed 找到 {len(news_items)} 條相關新聞\n")
        return news_items
        
    except Exception as e:
        print(f"❌ 獲取 RSS Feed 時發生錯誤: {str(e)}")
        raise


def fetch_news_content(url: str) -> str:
    """獲取新聞詳細內容"""
    try:
        response = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 嘗試多種可能的內容選擇器
        content_selectors = [
            '#pressrelease',
            '.pressrelease',
            '#content',
            '.content',
            'article',
            'main'
        ]
        
        content = ""
        for selector in content_selectors:
            element = soup.select_one(selector)
            if element:
                content = element.get_text().strip()
                break
        
        # 如果找不到特定容器，嘗試獲取所有段落
        if not content:
            paragraphs = soup.find_all('p')
            content = '\n\n'.join([
                p.get_text().strip() for p in paragraphs
                if len(p.get_text().strip()) > 20
            ])
        
        return content.strip() or "無法獲取新聞內容"
        
    except Exception as e:
        print(f"獲取新聞內容時發生錯誤 ({url}): {str(e)}")
        return "無法獲取新聞內容"


def announcement_exists(title: str) -> bool:
    """檢查公告是否已存在"""
    try:
        announcements_ref = db.collection('announcements')
        query = announcements_ref.where('title', '==', title).limit(1)
        docs = query.stream()
        return len(list(docs)) > 0
    except Exception as e:
        print(f"檢查公告是否存在時發生錯誤: {str(e)}")
        return False


def add_announcement(news: Dict[str, str]) -> bool:
    """添加公告到 Firestore"""
    try:
        # 檢查是否已存在
        if announcement_exists(news['title']):
            print(f"跳過已存在的公告: {news['title']}")
            return False
        
        # 使用 description 作為內容，如果沒有則獲取完整內容
        content = news.get('description') or news.get('content', '')
        if not content:
            print(f"正在獲取新聞內容: {news['title']}")
            content = fetch_news_content(news['url'])
        
        # 判斷是否為緊急
        is_urgent = is_fire_related(news['title']) and (
            '緊急' in news['title'] or
            '火警' in news['title'] or
            '火災' in news['title'] or
            '緊急' in content or
            '撤離' in content
        )
        
        # 設置標籤
        tag = 'urgent' if is_urgent else 'gov'
        
        # 解析日期
        try:
            date_match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', news['date'])
            if date_match:
                year, month, day = map(int, date_match.groups())
                timestamp = datetime(year, month, day)
            else:
                timestamp = firestore.SERVER_TIMESTAMP
        except:
            timestamp = firestore.SERVER_TIMESTAMP
        
        announcement = {
            'title': news['title'],
            'content': content,
            'source': '香港政府新聞公報',
            'url': news['url'],
            'isUrgent': is_urgent,
            'tag': tag,
            'timestamp': timestamp
        }
        
        db.collection('announcements').add(announcement)
        print(f"✅ 已添加公告: {news['title']}")
        return True
        
    except Exception as e:
        print(f"添加公告時發生錯誤 ({news['title']}): {str(e)}")
        return False


def fetch_and_add_gov_news():
    """主函數：獲取並添加新聞"""
    try:
        print("📰 開始獲取政府新聞公報...")
        
        # 獲取新聞
        news_list = fetch_gov_news()
        
        if not news_list:
            print("ℹ️  沒有找到相關的新聞")
            return {
                'success': True,
                'added': 0,
                'total': 0,
                'message': '沒有找到相關的新聞'
            }
        
        print(f"📝 開始處理 {len(news_list)} 條新聞...\n")
        
        added_count = 0
        for news in news_list:
            if add_announcement(news):
                added_count += 1
            # 添加延遲避免請求過快
            time.sleep(1)
        
        message = f"處理完成: 新增 {added_count} 條公告，共處理 {len(news_list)} 條新聞"
        print(f"✅ {message}")
        
        return {
            'success': True,
            'added': added_count,
            'total': len(news_list),
            'message': message
        }
        
    except Exception as e:
        print(f"❌ 執行失敗: {str(e)}")
        raise


if __name__ == '__main__':
    try:
        result = fetch_and_add_gov_news()
        print(f"\n執行完成: {result['message']}")
        sys.exit(0)
    except Exception as e:
        print(f"\n執行失敗: {str(e)}")
        sys.exit(1)

