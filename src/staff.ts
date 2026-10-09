// The people who can be hired at each shop, and what they're worth.
//
// Each shop is staffed the way such a place really is:
//   聞野燒烤 (a robata counter): the chef grills right in front of the customers and takes their orders himself, so
//     there's one chef (板前) and one cashier, no floor staff
//   鼎沸火鍋 (a hot pot restaurant): back-kitchen cooks prepare the plates, one cashier, and floor staff who seat
//     people and carry the food out
//   甲粗飽食堂 (a noodle shop): one or two noodle cooks at the pot, one cashier, perhaps one server
//
// Everyone has 手藝 (skill), 速度 (speed) and 體力 (stamina), from 1 to 100, and a wage by the hour. Better people
// cost more — mostly. Now and then someone is a bargain (good and cheap), and now and then someone is overpaid. While
// the shop is open they tire (faster with less stamina), and a tired worker works worse; with the shop closed they
// rest.

export type Role = 'chef' | 'sous' | 'cashier' | 'server'
export type Worker = {
  id: string
  zh: string
  ja: string
  role: Role
  skill: number
  speed: number
  stamina: number
  /** NT$ an hour */
  wage: number
  /** a line about them, for the hiring list */
  note: string
}

export const ROLES: Record<string, { role: Role; max: number; zh: string; ja: string }[]> = {
  // the owner is the head chef of every shop: what's hired is a second chef and a sous chef to help
  grilledfish: [
    { role: 'chef', max: 1, zh: '主廚（第二位板前）', ja: '板前（二番手）' },
    { role: 'sous', max: 1, zh: '副廚（備料・上火・收拾）', ja: '追い回し' },
    { role: 'cashier', max: 1, zh: '收銀', ja: 'レジ' },
  ],
  hotpot: [
    { role: 'chef', max: 1, zh: '主廚（顧湯）', ja: '料理長' },
    { role: 'sous', max: 1, zh: '副廚（備料）', ja: '副料理長（仕込み）' },
    { role: 'cashier', max: 1, zh: '收銀', ja: 'レジ' },
    { role: 'server', max: 3, zh: '外場服務生', ja: 'ホール' },
  ],
  beefnoodle: [
    { role: 'chef', max: 1, zh: '主廚（煮麵）', ja: '麺の料理長' },
    { role: 'sous', max: 1, zh: '副廚（顧湯・配料）', ja: '副料理長' },
    { role: 'cashier', max: 1, zh: '收銀', ja: 'レジ' },
    { role: 'server', max: 1, zh: '外場服務生', ja: 'ホール' },
  ],
}

// a fair wage for someone this good at this job (NT$/h): from about minimum wage (NT$196) up
const fair = (role: Role, skill: number) =>
  Math.round((role === 'chef' ? 200 + skill * 4.2 : role === 'sous' ? 196 + skill * 2.4 : role === 'server' ? 196 + skill * 1.4 : 196 + skill * 1.1) / 5) * 5

type Seed = [string, string, Role, number, number, number, number, string]
// [中文名, 日本語名, role, skill, speed, stamina, wage adjustment (1 = fair), note]
const POOL: Record<string, Seed[]> = {
  grilledfish: [
    ['佐藤 武', '佐藤 武', 'chef', 92, 78, 60, 1.05, '炭火三十年，火候一看就知道'],
    ['鈴木 正樹', '鈴木 正樹', 'chef', 74, 85, 82, 1.0, '手腳快，調味中規中矩'],
    ['高橋 浩二', '高橋 浩二', 'chef', 81, 62, 70, 0.72, '剛從京都回來，要價不高（撿到寶）'],
    ['渡辺 誠', '渡辺 誠', 'chef', 55, 70, 90, 1.0, '學徒出身，耐操'],
    ['中村 剛', '中村 剛', 'chef', 63, 58, 55, 1.35, '名店出身，但開價偏高'],
    ['山口 翔太', '山口 翔太', 'sous', 70, 86, 88, 1.0, '手腳麻利，備料上火一把罩'],
    ['井上 健', '井上 健', 'sous', 58, 74, 92, 0.8, '剛入行，便宜又耐操'],
    ['木村 大輔', '木村 大輔', 'sous', 82, 70, 62, 0.75, '居酒屋出身，撿到寶'],
    ['小林 美咲', '小林 美咲', 'cashier', 80, 82, 75, 1.0, '算帳又快又準'],
    ['加藤 由美', '加藤 由美', 'cashier', 58, 60, 88, 0.95, '親切，偶爾找錯錢'],
    ['松本 花', '松本 花', 'cashier', 88, 90, 64, 0.85, '前銀行行員，便宜又可靠'],
  ],
  hotpot: [
    ['陳志明', '陳 志明', 'chef', 84, 75, 70, 1.0, '刀工好，盤子擺得漂亮'],
    ['黃建宏', '黄 建宏', 'sous', 66, 88, 85, 0.85, '備料最快，價錢公道'],
    ['吳宗翰', '呉 宗翰', 'chef', 78, 70, 60, 0.7, '剛退伍，手藝不錯又便宜'],
    ['蔡明哲', '蔡 明哲', 'sous', 52, 55, 92, 1.0, '學徒，體力好'],
    ['何俊傑', '何 俊傑', 'sous', 74, 82, 80, 1.0, '備料又快又乾淨'],
    ['林雅婷', '林 雅婷', 'cashier', 82, 80, 70, 1.0, '記性好，熟客都記得'],
    ['王怡君', '王 怡君', 'cashier', 60, 64, 85, 1.0, '細心'],
    ['張淑芬', '張 淑芬', 'server', 86, 84, 78, 1.0, '外場十年，眼觀四面'],
    ['李家豪', '李 家豪', 'server', 64, 90, 88, 1.0, '大學生，跑得快'],
    ['劉佳穎', '劉 佳穎', 'server', 75, 72, 66, 0.75, '笑容滿分，時薪不高'],
    ['楊雅琪', '楊 雅琪', 'server', 50, 60, 70, 1.3, '新人卻開高價'],
  ],
  beefnoodle: [
    ['楊德福', '楊 徳福', 'chef', 90, 70, 64, 1.0, '老師傅，湯頭一絕'],
    ['周文彬', '周 文彬', 'sous', 70, 86, 84, 1.0, '煮麵速度快'],
    ['鄭大偉', '鄭 大偉', 'chef', 79, 74, 72, 0.7, '家傳手藝，價錢實在'],
    ['洪國華', '洪 国華', 'sous', 56, 62, 90, 1.0, '學徒'],
    ['孫立偉', '孫 立偉', 'sous', 76, 80, 74, 0.8, '顧湯一流，要價實在'],
    ['許美玲', '許 美玲', 'cashier', 76, 78, 80, 1.0, '收銀兼包外帶'],
    ['謝秀蘭', '謝 秀蘭', 'cashier', 62, 58, 86, 0.9, '老闆娘的表姊'],
    ['邱雅雯', '邱 雅雯', 'server', 72, 80, 76, 1.0, '端麵很穩'],
    ['簡志豪', '簡 志豪', 'server', 58, 88, 90, 0.8, '打工仔，便宜'],
  ],
}

export const CANDIDATES: Record<string, Worker[]> = Object.fromEntries(Object.entries(POOL).map(([shop, list]) => [shop,
  list.map(([zh, ja, role, skill, speed, stamina, adj, note], i) => ({
    id: `${shop}-${i}`, zh, ja, role, skill, speed, stamina, wage: Math.round((fair(role, skill) * adj) / 5) * 5, note,
  }))]))

/** how well they work right now: tired people work worse (at 100 fatigue, down to 55%) */
export const effective = (w: Worker, fatigue: number) => (w.skill * (1 - fatigue * 0.0045)) / 100

/** fatigue gained per minute open (0..100): the lower the stamina, the faster */
export const tirePerMin = (w: Worker) => 1.2 + (100 - w.stamina) * 0.05
/** fatigue shed per minute with the shop closed */
export const restPerMin = 6
