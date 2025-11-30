// 大埔災後援助資訊整合 (基於 PDF v1.3)
// 包含: 情緒支援, 託兒/學業, 住宿(完整版), 法律/醫療, 殯儀

export interface ReliefService {
  id: string
  category: 'emotional' | 'childcare' | 'education' | 'accommodation' | 'medical' | 'legal' | 'funeral' | 'pets'
  name: string
  provider: string
  description: string
  contact: string
  location: string
  openingHours?: string
  note?: string
  source_ref: string
  status?: string
}

export const fullReliefData: ReliefService[] = [
  // ==========================================
  // 1. 情緒支援 (Emotional Support) - PDF P.35-36
  // ==========================================
  {
    id: "emo-001",
    category: "emotional",
    name: "義務心理治療服務",
    provider: "樹洞香港 (TreeholeHK)",
    description: "提供義務心理治療服務",
    contact: "IG: @treehole.hk",
    location: "網上服務",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-002",
    category: "emotional",
    name: "24小時危機輔導及情緒支援",
    provider: "明愛向晴熱線",
    description: "24小時危機輔導",
    contact: "18288",
    location: "電話熱線",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-010",
    category: "emotional",
    name: "24小時情緒支援熱線",
    provider: "紅十字會 / 社會福利署",
    description: "24小時情緒支援熱線",
    contact: "2343 2255 (社署) / 18288 (明愛)",
    location: "電話熱線",
    source_ref: "PDF P.723"
  },
  {
    id: "emo-003",
    category: "emotional",
    name: "精神健康支援熱線",
    provider: "浸信會愛羣社會服務",
    description: "為6-24歲青少年提供網上情緒支援及文字輔導",
    contact: "2535 4135 / WhatsApp: 9101 2012",
    location: "灣仔愛群道36號",
    openingHours: "10:00 - 22:00",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-004",
    category: "emotional",
    name: "生命熱線",
    provider: "生命熱線",
    description: "由義工接聽，抒發困擾",
    contact: "2382 0000",
    location: "電話熱線",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-005",
    category: "emotional",
    name: "情緒通 (18111)",
    provider: "政府",
    description: "24小時熱線，提供多種語言支援 (包括少數族裔語言)",
    contact: "18111",
    location: "電話熱線",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-006",
    category: "emotional",
    name: "身心舒緩支援",
    provider: "頤君堂中醫診所",
    description: "為受影響居民及前線人員提供免費身心舒緩",
    contact: "6273 5809",
    location: "大圍新翠商場2樓22號舖",
    openingHours: "11月30-12月5日 10:00-13:00",
    source_ref: "PDF P.35"
  },
  {
    id: "emo-007",
    category: "emotional",
    name: "火災事件情緒支援熱線",
    provider: "鄰舍輔導會賽馬會大埔北青少年綜合服務中心",
    description: "24小時支援熱線",
    contact: "2651 1998 / 5720 2246 (麥先生)",
    location: "大埔富亨鄰里社區中心一樓",
    source_ref: "PDF P.36"
  },
  {
    id: "emo-008",
    category: "emotional",
    name: "青少年情緒支援",
    provider: "香港中華基督教青年會",
    description: "服務14-24歲青少年及其家人",
    contact: "2898 7802 (24小時)",
    location: "電話熱線",
    source_ref: "PDF P.36"
  },
  {
    id: "emo-009",
    category: "emotional",
    name: "緊急情緒支援 / 靈性服務",
    provider: "基督教家庭服務中心 / Elyisha Healing",
    description: "靈性療癒，輔導，亡靈安息儀式(人和寵物)",
    contact: "6466 4333 / WhatsApp: 6875 1845",
    location: "電話/網上",
    source_ref: "PDF P.36"
  },

  // ==========================================
  // 2. 託兒與學業支援 (Childcare & Education) - PDF P.29-33
  // ==========================================
  {
    id: "child-001",
    category: "childcare",
    name: "幼兒託管 (2-10歲)",
    provider: "東華三院方麗明幼兒園",
    description: "免費繪本故事、多元遊戲、提供三餐",
    contact: "2656 5225 / 6259 7398",
    location: "大埔墟懷義街14-18號",
    note: "至11月30日",
    source_ref: "PDF P.29"
  },
  {
    id: "child-002",
    category: "childcare",
    name: "受災居民24小時臨時庇護/託兒",
    provider: "大埔浸信會教育樓",
    description: "情緒支援、託兒服務",
    contact: "2653 2393",
    location: "大埔社區中心5樓",
    source_ref: "PDF P.29"
  },
  {
    id: "child-003",
    category: "childcare",
    name: "兒童暫託服務",
    provider: "保良局 (多間中心)",
    description: "沙田瀝源(2692 0428)、沙田美田(2663 1254)、大埔慧妍雅集(2769 0208)、鄧碧雲紀念幼稚園(2656 2016)",
    contact: "見描述",
    location: "沙田及大埔多處",
    source_ref: "PDF P.30"
  },
  {
    id: "child-004",
    category: "childcare",
    name: "社區客廳 / 緊急課餘託管",
    provider: "信義會太和 / 路德會賽馬會富善",
    description: "無需預約直接帶小朋友前往 (信義會); 緊急課餘託管 (路德會)",
    contact: "信義會: 6252 7016 / 路德會: 2661 3880",
    location: "太和邨麗和樓 / 富善邨善群樓",
    source_ref: "PDF P.31"
  },
  {
    id: "child-005",
    category: "childcare",
    name: "暫託家庭配對",
    provider: "18同行",
    description: "配對義工家庭暫託小朋友及協助尋找臨時安置",
    contact: "6313 6052 (Karen)",
    location: "網上配對: www.greenfeet18.com",
    source_ref: "PDF P.31"
  },
  // 學業支援 (IG 義工)
  {
    id: "edu-001",
    category: "education",
    name: "免費補習與功課輔導",
    provider: "社區義工 (IG)",
    description: "多位義工提供中英數、DSE、大學申請等免費支援",
    contact: "IG: @ememleaf (全科), @forewordenglish (英文), @dse.math.wano (數學), @ict_dse_hk (ICT)",
    location: "網上 / 大埔",
    note: "詳情請查看 PDF P.32-33 或直接 DM 相關 IG",
    source_ref: "PDF P.32-33"
  },
  {
    id: "edu-002",
    category: "education",
    name: "免費影印 Notes",
    provider: "@yummeprint",
    description: "大埔昌運中心免費影印筆記",
    contact: "IG: @yummeprint",
    location: "大埔昌運中心",
    source_ref: "PDF P.32"
  },

  // ==========================================
  // 3. 殯儀支援 (Funeral Support) - PDF P.34, 39
  // ==========================================
  {
    id: "fun-001",
    category: "funeral",
    name: "東華三院殯儀基金",
    provider: "東華三院",
    description: "承擔每宗個案上限8萬，提供全套殮葬服務 (棺木、儀式、靈車等)",
    contact: "2657 7899 / 2303 1234",
    location: "萬國/鑽石山/寰宇殯儀館",
    note: "必須委託其屬下殯儀館",
    source_ref: "PDF P.34, 710, 714"
  },
  {
    id: "fun-002",
    category: "funeral",
    name: "免費喪葬服務",
    provider: "毋忘愛",
    description: "免費喪葬服務及支援轉介",
    contact: "3488 4933 / 9610 9789",
    location: "-",
    source_ref: "PDF P.39"
  },
  {
    id: "fun-003",
    category: "funeral",
    name: "一切從簡",
    provider: "一切從簡",
    description: "支援大火喪親的應急方案",
    contact: "info@hkldsa.org.hk",
    location: "-",
    source_ref: "PDF P.39"
  },
  {
    id: "fun-004",
    category: "funeral",
    name: "殯儀支援與哀傷輔導",
    provider: "贐明會",
    description: "殯葬實務諮詢、陪伴認領遺體",
    contact: "5721 8354 (WhatsApp)",
    location: "-",
    source_ref: "PDF P.39"
  },
  {
    id: "fun-005",
    category: "funeral",
    name: "慰天使 / 後顧無憂",
    provider: "聖公會聖匠堂 / 聖雅各福群會",
    description: "緊急殯葬資助、實務支援",
    contact: "聖匠堂: 5174 8838 / 聖雅各: 5537 2431",
    location: "-",
    source_ref: "PDF P.39"
  },
  {
    id: "fun-006",
    category: "funeral",
    name: "仁濟緊急援助基金",
    provider: "仁濟醫院",
    description: "每名遇難者家屬援助 $20,000",
    contact: "8100 7711",
    location: "-",
    source_ref: "PDF P.39"
  },

  // ==========================================
  // 4. 法律與額外醫療 (Legal & Medical) - PDF P.42
  // ==========================================
  {
    id: "leg-001",
    category: "legal",
    name: "免費法律諮詢",
    provider: "公益法香港 (Pro Bono HK)",
    description: "人身傷亡、保險、勞工保障、遺產諮詢",
    contact: "9229 7517",
    location: "https://zh.probonohk.org/",
    source_ref: "PDF P.42"
  },
  {
    id: "med-001",
    category: "medical",
    name: "元朗醫館",
    provider: "元朗醫館",
    description: "中醫/針灸/推拿 (免費)",
    contact: "6316 5880",
    location: "元朗宏業南街12-18號新順福中心3樓8室",
    openingHours: "至2025-12-12",
    note: "宏福苑居民及救援人員",
    source_ref: "PDF P.412, 416, 422"
  },
  {
    id: "med-002",
    category: "medical",
    name: "醫療站 / 藥劑師諮詢",
    provider: "醫務衛生局 / 聖雅各福群會",
    description: "臨時庇護中心醫療站 (08:00-20:00); 藥劑師諮詢 (2116 8836)",
    contact: "見描述",
    location: "各臨時庇護中心",
    source_ref: "PDF P.42"
  },
  {
    id: "med-003",
    category: "medical",
    name: "明恩義診",
    provider: "明恩",
    description: "處方藥物紓緩吸入濃煙不適",
    contact: "3615 8331 (需預約)",
    location: "大埔廣福邨 / 富亨邨",
    source_ref: "PDF P.42"
  },
  // 寵物醫療服務
  {
    id: "pet-001",
    category: "pets",
    name: "城大醫療動物中心",
    provider: "城大醫療動物中心",
    description: "貓狗醫療協助 (豁免診金)",
    contact: "3650 3200",
    location: "深水埗醫局街202號",
    source_ref: "PDF P.469, 472, 474"
  },
  {
    id: "pet-002",
    category: "pets",
    name: "N24社區動物醫院",
    provider: "N24社區動物醫院",
    description: "24小時醫療、免費診金X光、借用氧氣",
    contact: "2956 5999 / 9790 5359",
    location: "洪水橋德興樓地下",
    source_ref: "PDF P.497, 500, 505"
  },
  {
    id: "pet-003",
    category: "pets",
    name: "NPV 動物流動獸醫診所",
    provider: "NPV 動物流動獸醫診所",
    description: "緊急醫療 (費用全免)",
    contact: "5931 9764",
    location: "大埔運頭街10號聖母無玷之心堂",
    note: "優先預留急症位置",
    source_ref: "PDF P.483, 487, 495"
  },

  // ==========================================
  // 5. 臨時住宿/休息站補充 (Accommodation) - PDF P.37, 38, 41
  // ==========================================
  {
    id: "acc-001",
    category: "accommodation",
    name: "大埔善樓",
    provider: "善導會",
    description: "即日起直接接收受影響居民，提供臨時住宿",
    contact: "4645 2763 (WhatsApp)",
    location: "大埔船灣陳屋168號",
    status: "Open",
    source_ref: "PDF P.38"
  },
  {
    id: "acc-002",
    category: "accommodation",
    name: "策誠軒",
    provider: "房協 / 社協",
    description: "需先聯絡房協登記 (2331 3110)，再親臨填表",
    contact: "2331 3110",
    location: "大埔公路4105號",
    source_ref: "PDF P.38"
  },
  {
    id: "acc-003",
    category: "accommodation",
    name: "明愛賓館 (白英奇/張奧偉)",
    provider: "香港明愛",
    description: "已預留適合家庭入住的房間",
    contact: "油麻地: 2388 1111 / 香港仔: 2903 0111",
    location: "油麻地 / 香港仔",
    source_ref: "PDF P.41"
  },
  {
    id: "acc-004",
    category: "accommodation",
    name: "過渡性房屋 (七星薈/雙魚薈)",
    provider: "路德會",
    description: "提供緊急支援單位",
    contact: "9644 4038 / 9299 9412",
    location: "元朗錦泰路 / 粉錦公路",
    source_ref: "PDF P.41"
  },
  {
    id: "acc-rest-001",
    category: "accommodation",
    name: "教會與社區休息站",
    provider: "多個團體",
    description: "提供通宵開放或日間暫避。包括: 宣道會大埔堂 (9746 8710)、禮賢會大埔堂 (2665 1786)、大埔聖母無玷之心堂 (2652 2655)、救世軍大埔 (2667 2913)",
    contact: "見描述",
    location: "大埔區內多處",
    note: "詳細名單請參閱 PDF P.37",
    source_ref: "PDF P.37"
  }
]

