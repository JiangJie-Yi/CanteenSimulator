// The names customers leave their reviews under, as on a map app's (the owner's): a real name, a nickname, an English name, a handle; one
// fixed by each customer's id, in each language. What kind of customer they were (game's GuestKind) is only a small tag beside it.
import type { Lang } from './i18n'

export const REVIEWER_NAMES: Record<Lang, string[]> = {
  zh: [
    '陳怡君', '林志豪', '張雅婷', '王俊傑', '李佩珊', '黃冠宇', '吳欣怡', '劉家豪', '蔡宜蓁', '楊承恩', '許雅雯', '鄭宇翔', '謝佳穎', '洪志明', '郭芷涵',
    '曾柏翰', '邱詩涵', '廖建宏', '賴韻如', '周子軒', '徐詩婷', '蕭博文', '葉品妤', '簡士傑', '彭郁雯',
    '阿德', '小魚', '胖虎', '阿凱', '小芸', '老張', '阿嬤的孫子', '大頭', '小米', '阿翔', '肉肉', '小黑', '阿美姐', '貓奴一號', '吃貨小姐',
    'Kevin 林', 'Amy Chen', 'Jason Wu', 'Ivy 黃', 'Tony Lee', 'Vivian 張', 'Eric Tsai', 'Grace 王', 'Leo Hsu', 'Mia Lin',
    '深夜食堂常客', '美食偵探 K', '週末吃貨', '烤魚愛好者', '台北通勤族', '月光族小薪',
  ],
  ja: [
    '佐藤 美咲', '鈴木 大輔', '高橋 陽菜', '田中 翔太', '伊藤 結衣', '渡辺 健', '山本 さくら', '中村 拓海', '小林 葵', '加藤 誠',
    '吉田 彩', '山田 太郎', '佐々木 優', '山口 蓮', '松本 美穂', '井上 悠斗', '木村 七海', '林 隼人', '清水 杏', '斎藤 亮',
    'ゆき', 'たっくん', 'みーちゃん', 'けんじ', 'あやの', 'ぽんた', 'さとし', 'はるか', 'のりお', 'まめ',
    'Yuki S.', 'Kenta M.', 'Aoi T.', 'Ryo K.', 'Mika H.', 'Sho N.',
    '飲み歩き部長', '焼き魚好き', '夜更かし会社員', 'グルメ探偵', '週末ハンター', '天満の住人',
  ],
  en: [
    'Mike Thompson', 'Sarah Lee', 'David Kim', 'Emily Chen', 'James Wilson', 'Olivia Brown', 'Daniel Park', 'Sophie Martin', 'Chris Evans',
    'Hannah Davis', 'Lucas Garcia', 'Chloe Nguyen', 'Ryan Murphy', 'Grace Liu', 'Ben Carter', 'Zoe Clark', 'Tom Baker', 'Lily Wong',
    'Jake R.', 'Anna K.', 'Sam P.', 'Nina L.', 'Max H.', 'Ella M.', 'Owen B.', 'Ivy T.',
    'foodie_kat', 'nightowl88', 'grill_seeker', 'tokyo_wanderer', 'ramen_ron', 'salty_sam', 'midnight_mia', 'fishfan_jo',
    'Local Guide Ken', 'Weekend Eater', 'Osaka Explorer', 'Late Shift Lou',
  ],
}

/** the name a customer reviews under, in a language: fixed by their id, scattered so neighbours seldom match */
export function reviewerName(id: number, lang: Lang): string {
  let h = Math.imul(id ^ 0x5bd1e995, 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39)
  h ^= h >>> 13
  const pool = REVIEWER_NAMES[lang] ?? REVIEWER_NAMES.zh
  return pool[(h >>> 0) % pool.length]
}

/** the names of reviews shown together (newest first): each its own, but where one would repeat a name already on the page, the next in
 * the pool that isn't (the same every time for the same list) */
export function reviewerNames(ids: number[], lang: Lang): string[] {
  const pool = REVIEWER_NAMES[lang] ?? REVIEWER_NAMES.zh
  const used = new Set<string>()
  return ids.map((id) => {
    let name = reviewerName(id, lang)
    for (let k = pool.indexOf(name); used.has(name) && used.size < pool.length;) { k = (k + 1) % pool.length; name = pool[k] }
    used.add(name)
    return name
  })
}
