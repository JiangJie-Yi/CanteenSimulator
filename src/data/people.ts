// What people who come to be hired are made of: names (Taiwanese and Japanese, by sex and by generation, the way
// names really run in each), where they've worked before, and what they're like. game/hiring.ts puts these
// together at random, so each new game has a different set of people.
import type { Look, Role } from '@/data/staff'

type Age = Look['age']
type ByAge = Record<Age, string[]>

export const TW_SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾', '邱', '廖',
  '賴', '周', '徐', '蘇', '葉', '莊', '呂', '江', '何', '蕭', '羅', '高', '潘', '簡', '朱', '鍾', '彭', '游', '詹', '胡', '施', '沈',
  '余', '盧', '梁', '趙', '顏', '柯', '翁', '魏', '孫', '戴']

/** Taiwanese given names, two characters: the first from one list, the second from the other (older people's
 * names run to 福, 雄, 秀, 玉; younger ones to 宇, 翔, 涵, 妤) */
export const TW_GIVEN: Record<'male' | 'female', Record<Age, [string[], string[]]>> = {
  male: {
    old: [['德', '國', '金', '永', '清', '文', '明', '正', '榮', '春'], ['福', '雄', '財', '輝', '隆', '發', '昌', '義', '仁', '生']],
    middle: [['志', '建', '家', '俊', '宗', '明', '冠', '國', '政', '嘉', '信', '世', '振', '育', '立'], ['明', '宏', '豪', '傑', '翰', '哲', '偉', '華', '誠', '銘', '峰', '賢', '強', '鈞']],
    young: [['子', '宇', '承', '品', '柏', '彥', '冠', '宥', '睿', '浩', '博', '恩'], ['翔', '睿', '宇', '廷', '霖', '安', '凱', '瑋', '恩', '辰', '叡', '勳']],
  },
  female: {
    old: [['秀', '玉', '美', '淑', '麗', '月', '金', '素', '寶', '春'], ['蘭', '芬', '華', '珠', '英', '琴', '霞', '鳳', '雲', '娥']],
    middle: [['雅', '怡', '佳', '淑', '美', '佩', '惠', '曉', '靜', '慧', '婉', '宜'], ['婷', '君', '芬', '琪', '玲', '雯', '慧', '惠', '華', '娟', '如', '萍']],
    young: [['心', '依', '筱', '詩', '品', '子', '語', '欣', '芷', '宇', '思', '于'], ['涵', '萱', '妤', '彤', '恩', '晴', '瑄', '柔', '璇', '甯', '潔', '庭']],
  },
}

/** how a Taiwanese name's characters are written in Japanese */
export const TO_JA: Record<string, string> = {
  黃: '黄', 國: '国', 德: '徳', 吳: '呉', 莊: '荘', 賴: '頼', 顏: '顔', 惠: '恵', 曉: '暁', 靜: '静', 榮: '栄', 寶: '宝', 發: '発',
  鳳: '鳳', 雲: '雲', 麗: '麗', 鍾: '鍾', 蕭: '蕭', 劉: '劉', 鄭: '鄭', 謝: '謝', 蘇: '蘇', 葉: '葉', 傑: '傑', 輝: '輝', 豪: '豪',
  勳: '勲', 瑄: '瑄', 甯: '寧', 叡: '叡', 萱: '萱', 嘉: '嘉', 義: '義', 冠: '冠', 潔: '潔',
}

export const JP_SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口',
  '松本', '井上', '木村', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '小川', '岡田', '後藤', '長谷川',
  '村上', '近藤', '石井', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田', '三浦']

export const JP_GIVEN: Record<'male' | 'female', ByAge> = {
  male: {
    old: ['武', '茂', '勇', '清', '勝', '博', '実', '正雄', '一郎', '健一', '昭', '進'],
    middle: ['大輔', '健太', '誠', '剛', '浩二', '正樹', '直樹', '隆', '達也', '和也', '修', '智之'],
    young: ['翔太', '蓮', '大翔', '悠真', '陽斗', '湊', '颯太', '拓海', '健', '翼', '陸', '樹'],
  },
  female: {
    old: ['和子', '洋子', '幸子', '節子', '久美子', '恵子', '明美', '順子'],
    middle: ['由美', '直美', '裕子', '智子', '真由美', '香織', '美穂', '恵'],
    young: ['美咲', 'さくら', '陽菜', '結衣', '葵', '凛', '花', '芽衣', '彩'],
  },
}

/** where they've worked before, by shop and job and how long they've been at it (any shop: '*') */
export const BACKGROUNDS: Record<string, Partial<Record<Role, Partial<ByAge>>>> = {
  grilledfish: {
    chef: {
      old: ['炭火三十年', '老字號燒鳥店出身', '在築地魚市場待過二十年', '在京都割烹當過板前'],
      middle: ['居酒屋掌爐十年', '剛從東京回來', '飯店日料部出身', '跑過幾家燒肉店'],
      young: ['學徒出身', '剛出師', '料理學校畢業', '在居酒屋打過工'],
    },
    sous: { middle: ['居酒屋出身', '燒肉店內場出身'] },
    server: { middle: ['居酒屋外場五年'] },
    stock: { middle: ['魚市場送貨出身'], old: ['在漁港批發做了一輩子'] },
  },
  hotpot: {
    chef: {
      old: ['火鍋店老師傅', '顧湯三十年', '開過自己的火鍋店'],
      middle: ['從連鎖火鍋店出來', '涮涮鍋店店長退下來', '川菜館出身'],
      young: ['剛退伍', '餐飲科畢業', '在火鍋店打過工'],
    },
  },
  beefnoodle: {
    chef: {
      old: ['老師傅', '眷村麵館出身', '家傳三代的麵館'],
      middle: ['麵攤做了十年', '家傳手藝', '夜市擺過攤', '小吃店掌杓八年'],
      young: ['學徒', '剛學會煮湯頭', '在麵館打過工'],
    },
  },
  bakery: {
    chef: {
      old: ['烘焙二十年', '老麵包店的師傅', '開過自己的麵包坊'],
      middle: ['法國藍帶出身', '在日本學過烘焙', '飯店烘焙坊出來'],
      young: ['剛出師', '烘焙科畢業', '在麵包店當過學徒'],
    },
    sous: { middle: ['麵包店內場出身'] },
    server: { middle: ['做過咖啡廳'] },
  },
  '*': {
    stock: {
      old: ['市場批發做了二十年', '雜貨店顧了二十年', '倉庫管理退休'],
      middle: ['物流倉管出身', '做過超市理貨', '跑過市場叫貨', '餐廳採購五年'],
      young: ['大學生打工', '剛退伍', '做過超商理貨', '物流打工過'],
    },
    chef: { old: ['廚房做了大半輩子'], middle: ['做過幾家餐廳'], young: ['料理學校畢業'] },
    sous: {
      old: ['廚房做了大半輩子', '退休後想找點事做'],
      middle: ['餐廳內場五年', '做過幾家餐廳的內場', '自助餐店幫過忙'],
      young: ['剛入行', '學徒', '餐飲科學生', '剛退伍'],
    },
    cashier: {
      old: ['前銀行行員', '雜貨店顧了二十年', '老闆的遠房親戚'],
      middle: ['超市收銀出身', '做過會計', '當過便利商店店長'],
      young: ['大學生打工', '剛畢業', '高職商科畢業'],
    },
    server: {
      old: ['外場十年', '老餐廳的領班'],
      middle: ['飯店宴會廳出來', '做過咖啡廳', '連鎖餐廳外場五年'],
      young: ['大學生打工', '打工仔', '剛畢業', '高中生暑假打工'],
    },
  },
}

/** what they're like, by what they're good or bad at */
export const TRAITS: Record<'skillHigh' | 'skillLow' | 'speedHigh' | 'speedLow' | 'staminaHigh' | 'staminaLow', Partial<Record<Role | '*', string[]>>> = {
  skillHigh: {
    chef: ['手藝沒話說', '火候抓得準', '調味很準', '做菜很講究'],
    sous: ['做事細', '刀工乾淨', '備料一把罩'],
    cashier: ['算帳又快又準', '記性好，熟客都記得', '從沒找錯過錢'],
    server: ['眼觀四面', '招呼客人有一套', '笑容滿分'],
    stock: ['盤點一絲不苟', '跟菜商很熟，拿得到好價錢', '叫貨從不出錯'],
  },
  skillLow: {
    chef: ['手藝還在磨', '調味中規中矩', '偶爾失手'],
    sous: ['還在學', '有時丟三落四'],
    cashier: ['偶爾找錯錢', '算帳要多看兩眼'],
    server: ['還不太熟', '偶爾送錯桌'],
    stock: ['偶爾叫錯貨', '還不太會殺價'],
  },
  speedHigh: { '*': ['手腳快', '動作麻利', '做事很快'], server: ['跑得快'] },
  speedLow: { '*': ['慢工出細活', '動作慢了點'] },
  staminaHigh: { '*': ['耐操', '整天站著也不累', '體力好'] },
  staminaLow: { '*': ['體力普通', '做久了會累'] },
}

/** about the pay they ask */
export const PAY = {
  bargainGood: ['要價不高（撿到寶）', '開價實在（撿到寶）'],
  bargain: ['便宜', '時薪不高'],
  dear: ['但開價偏高', '要價不低'],
  dearNew: ['新人卻開高價'],
}
