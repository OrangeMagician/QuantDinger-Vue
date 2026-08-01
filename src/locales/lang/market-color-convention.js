const messages = {
  'en-US': ['Market colors', 'Rise red / fall green', 'Rise green / fall red'],
  'zh-CN': ['市场涨跌配色', '涨红跌绿', '涨绿跌红'],
  'zh-TW': ['市場漲跌配色', '漲紅跌綠', '漲綠跌紅'],
  'ja-JP': ['市場カラー', '上昇は赤 / 下落は緑', '上昇は緑 / 下落は赤'],
  'ko-KR': ['시장 색상', '상승 빨강 / 하락 초록', '상승 초록 / 하락 빨강'],
  'de-DE': ['Marktfarben', 'Anstieg rot / Fall gruen', 'Anstieg gruen / Fall rot'],
  'fr-FR': ['Couleurs du marche', 'Hausse rouge / baisse verte', 'Hausse verte / baisse rouge'],
  'ru-RU': ['Цвета рынка', 'Рост красный / падение зеленое', 'Рост зеленый / падение красное'],
  'th-TH': ['สีตลาด', 'ขึ้นสีแดง / ลงสีเขียว', 'ขึ้นสีเขียว / ลงสีแดง'],
  'vi-VN': ['Mau thi truong', 'Tang do / giam xanh', 'Tang xanh / giam do'],
  'ar-SA': ['ألوان السوق', 'الصعود أحمر / الهبوط أخضر', 'الصعود أخضر / الهبوط أحمر']
}

export default Object.keys(messages).reduce((locales, locale) => {
  const [title, riseRed, riseGreen] = messages[locale]
  locales[locale] = {
    'app.setting.marketColors': title,
    'app.setting.marketColors.riseRed': riseRed,
    'app.setting.marketColors.riseGreen': riseGreen
  }
  return locales
}, {})
