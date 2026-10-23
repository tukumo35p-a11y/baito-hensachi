// フロントとサーバー（Pages Functions）で共有する定数

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];
// 都道府県コード（1〜47）→ 名前
export const prefName = (code) => PREFECTURES[code - 1] ?? '不明';

export const INDUSTRIES = [
  { key: 'food_hall', label: '飲食ホール' },
  { key: 'food_kitchen', label: '飲食キッチン' },
  { key: 'convenience', label: 'コンビニ' },
  { key: 'retail', label: 'スーパー・小売' },
  { key: 'apparel', label: 'アパレル' },
  { key: 'tutor', label: '塾講師・家庭教師' },
  { key: 'office', label: '事務・データ入力' },
  { key: 'warehouse', label: '倉庫・軽作業' },
  { key: 'event', label: 'イベント・販促' },
  { key: 'call_center', label: 'コールセンター' },
  { key: 'hotel', label: 'ホテル・レジャー' },
  { key: 'delivery', label: '配達・デリバリー' },
  { key: 'care', label: '医療・介護' },
  { key: 'other', label: 'その他' },
];
export const industryLabel = (key) => INDUSTRIES.find((i) => i.key === key)?.label ?? '不明';

// key は DB の列名 perk_<key> に対応
export const PERKS = [
  { key: 'transport', label: '交通費支給' },
  { key: 'training', label: '研修中も時給が出る' },
  { key: 'meal', label: 'まかない・社割' },
  { key: 'raise', label: '昇給がある' },
  { key: 'flexible', label: 'シフトの融通がきく' },
];

export const LIMITS = {
  wage: { min: 800, max: 10000 },
  hours: { min: 1, max: 60 },
};

// 集計まわりのしきい値
export const MIN_SCOPE_N = 10; // これ未満の範囲は「データ不足」
export const RELIABLE_N = 30; // 全国がこれ未満の間は「参考値」
export const DAILY_POST_LIMIT = 5; // 同じ IP ハッシュから1日あたりの投稿上限
