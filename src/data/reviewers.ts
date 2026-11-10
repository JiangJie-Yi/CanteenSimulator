// The names customers leave their reviews under, as on a map app's (the owner's): a real name, a nickname, a handle, fixed by each
// customer's id. The shop's in Osaka (the owner's, 2026-11-10): about three in four Japanese, the rest Taiwanese visitors and tourists from
// further off; each written as its owner writes it (a review site doesn't translate names), the same whatever the page's language. And
// each reviewer's profile, as the map app shows it: a Local Guide or not, how many reviews they've written, how many found this one useful.

const JAPANESE = [
  '佐藤 美咲', '鈴木 大輔', '高橋 陽菜', '田中 翔太', '伊藤 結衣', '渡辺 健', '山本 さくら', '中村 拓海', '小林 葵', '加藤 誠',
  '吉田 彩', '山田 太郎', '佐々木 優', '山口 蓮', '松本 美穂', '井上 悠斗', '木村 七海', '林 隼人', '清水 杏', '斎藤 亮',
  '森 千尋', '池田 大和', '橋本 茜', '阿部 剛', '石川 真由', '前田 一輝', '藤田 舞', '岡田 修', '後藤 楓', '長谷川 陸',
  '村上 結菜', '近藤 慎也', '坂本 麻衣', '遠藤 浩二', '青木 美月', '西村 颯', '福田 恵', '太田 康介', '三浦 遥', '藤井 直樹',
  'ゆき', 'たっくん', 'みーちゃん', 'けんじ', 'あやの', 'ぽんた', 'さとし', 'はるか', 'のりお', 'まめ', 'こうへい', 'ちひろ',
  'Yuki S.', 'Kenta M.', 'Aoi T.', 'Ryo K.', 'Mika H.', 'Sho N.', 'Daiki O.', 'Rina F.',
  '飲み歩き部長', '焼き魚好き', '夜更かし会社員', 'グルメ探偵', '週末ハンター', '天満の住人', '大阪食べ歩き', '酒場めぐり', 'なにわの呑兵衛', 'はしご酒課長',
]
const TAIWANESE = [
  '陳怡君', '林志豪', '張雅婷', '王俊傑', '李佩珊', '黃冠宇', '吳欣怡', '劉家豪', '小魚', '阿凱', 'Kevin 林', 'Amy Chen', '台北通勤族', '吃貨小姐',
]
const FOREIGN = [
  'Mike Thompson', 'Sarah Lee', 'David Kim', 'Emily Chen', 'James Wilson', 'Olivia Brown', 'Sophie Martin', 'Lucas Garcia',
  'foodie_kat', 'nightowl88', 'tokyo_wanderer', 'Osaka Explorer', 'Jake R.', 'Anna K.',
]
/** the names, by where their reviewers are from */
export const REVIEWER_NAMES = { japanese: JAPANESE, taiwanese: TAIWANESE, foreign: FOREIGN }
/** how many in a hundred reviewers are Japanese, and how many Taiwanese (the rest from further off) */
export const JAPANESE_SHARE = 76
export const TAIWANESE_SHARE = 12

/** a well-scattered number from an id (each `salt` its own) */
function mix(id: number, salt: number) {
  let h = Math.imul(id ^ salt, 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39)
  h ^= h >>> 13
  return h >>> 0
}
/** where a reviewer's from: their pool of names */
const poolOf = (id: number) => {
  const k = mix(id, 0x5bd1e995) % 100
  return k < JAPANESE_SHARE ? JAPANESE : k < JAPANESE_SHARE + TAIWANESE_SHARE ? TAIWANESE : FOREIGN
}

/** the name a customer reviews under: fixed by their id, scattered so neighbours seldom match */
export function reviewerName(id: number): string {
  const pool = poolOf(id)
  return pool[mix(id, 0x1b873593) % pool.length]
}

/** the names of reviews shown together: each its own, but where one would repeat a name already on the page, the next in its pool that
 * isn't (the same every time for the same list) */
export function reviewerNames(ids: number[]): string[] {
  const used = new Set<string>()
  return ids.map((id) => {
    const pool = poolOf(id)
    let name = reviewerName(id)
    for (let k = pool.indexOf(name), tries = 0; used.has(name) && tries < pool.length; tries++) { k = (k + 1) % pool.length; name = pool[k] }
    used.add(name)
    return name
  })
}

/** a reviewer's profile, as a map app shows it: a Local Guide or not (about a third are), how many reviews they've written, and how many
 * found this one useful */
export function reviewerProfile(id: number) {
  const g = mix(id, 0x68e31da4)
  const guide = g % 100 < 34
  const reviews = guide ? 12 + ((g >>> 8) % 260) : 1 + ((g >>> 8) % 18)
  const useful = (g >>> 17) % 100 < 45 ? 1 + ((g >>> 24) % (guide ? 14 : 5)) : 0
  return { guide, reviews, useful }
}
