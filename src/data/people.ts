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
    old: ['武', '茂', '勇', '清', '勝', '博', '実', '正雄', '一郎', '健一', '昭', '進', '三郎', '秀夫'],
    middle: ['大輔', '健太', '誠', '剛', '浩二', '正樹', '直樹', '隆', '達也', '和也', '修', '智之', '亮', '健二'],
    young: ['翔太', '蓮', '大翔', '悠真', '陽斗', '湊', '颯太', '拓海', '健', '翼', '陸', '樹', '悠斗', '海斗'],
  },
  female: {
    old: ['和子', '洋子', '幸子', '節子', '久美子', '恵子', '明美', '順子', '美代子', '良子'],
    middle: ['由美', '直美', '裕子', '智子', '真由美', '香織', '美穂', '恵', '理恵', '亜希子'],
    young: ['美咲', 'さくら', '陽菜', '結衣', '葵', '凛', '花', '芽衣', '彩', '莉子', '美月', '杏'],
  },
}

/** where they've worked before, by shop and job and how long they've been at it (any shop: '*') */
export const BACKGROUNDS: Record<string, Partial<Record<Role, Partial<ByAge>>>> = {
  grilledfish: {
    chef: {
      old: ['炭火三十年', '老字號燒鳥店出身', '在築地魚市場待過二十年', '在京都割烹掌過廚', '銀座壽司店做了二十五年', '爐端燒老店的燒き方',
        '在北海道漁港邊開過爐端燒', '老字號鰻魚店顧了半輩子的炭'],
      middle: ['居酒屋掌爐十年', '剛從東京回來', '飯店日料部出身', '跑過幾家燒肉店', '大阪串燒店掌爐八年', '燒鳥店的燒き手', '割烹料理店的焼き方',
        '在九州的漁村學過烤魚'],
      young: ['學徒出身', '剛出師', '料理學校畢業', '在居酒屋打過工', '燒鳥店串了三年雞肉串', '日料店的見習い', '料理比賽拿過獎', '跟著爺爺烤了好幾年魚'],
    },
    sous: {
      old: ['壽司店的老幫手', '在市場殺了一輩子魚'],
      middle: ['居酒屋出身', '燒肉店內場出身', '日料店備料五年', '便當店的內場主力'],
      young: ['燒鳥店打工三年', '日料店洗碗做起', '餐飲科實習過日料'],
    },
    server: {
      old: ['料亭的仲居做了二十年'],
      middle: ['居酒屋外場五年', '日本料理店的外場領班'],
      young: ['居酒屋打工兩年', '拉麵店外場', '會一點日文的大學生'],
    },
    cashier: {
      old: ['在菜市場幫忙收錢三十年'],
      middle: ['日式百貨的收銀', '居酒屋收銀兼點餐'],
      young: ['便利商店大夜班'],
    },
    stock: { middle: ['魚市場送貨出身'], old: ['在漁港批發做了一輩子'] },
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

/** a few words of their own, for the hiring list: why they want the job (by age), what they do off work, when they
 * can work */
export const INTRO = {
  why: {
    young: ['想學一技之長', '想存錢出國', '喜歡熱鬧的工作環境', '想試試看餐飲業', '家裡開小吃店，想多見識', '想邊工作邊學日文', '想學烤魚的手藝',
      '以後想開自己的店'],
    middle: ['孩子上學了，想回到職場', '想找穩定的工作', '前公司收掉了，想換個跑道', '想離家近一點', '做這行習慣了，閒不下來', '一直想在日式老店做事'],
    old: ['退休了閒不住', '想把手藝傳下去', '老伴說我該出門走走', '做了一輩子，還想再做幾年', '孫子都大了，想找點事做', '想在吧台後面看客人吃得開心'],
  },
  likes: ['假日喜歡爬山', '喜歡看棒球', '平常會自己做菜', '喜歡釣魚', '會彈一點吉他', '每天晨跑', '喜歡逛市場', '愛看日劇', '會一點台語和日語', '喜歡養花',
    '喜歡泡湯', '寫得一手好書法', '愛看相撲', '喜歡拍照', '收集清酒瓶', '週末去海邊衝浪', '喜歡玩桌遊', '會做和菓子'],
  when: ['晚班週末都可以', '只能排平日', '可以配合排班', '希望排早班', '隨時可以上班', '下個月才能報到', '只能做晚上', '週末不行', '可以加班'],
}

// How the names read in English: Japanese ones in Hepburn romaji, Taiwanese ones the way a Taiwanese passport spells
// them (Wade-Giles, the given name hyphenated); given name first either way
const romaji = (list: string) => Object.fromEntries(list.trim().split(/\s+/).map((x) => [x.replace(/[A-Za-z]+$/, ''), x.match(/[A-Za-z]+$/)![0]]))
export const JP_ROMAJI: Record<string, string> = romaji(`
  佐藤Sato 鈴木Suzuki 高橋Takahashi 田中Tanaka 渡辺Watanabe 伊藤Ito 中村Nakamura 小林Kobayashi 加藤Kato 吉田Yoshida 山田Yamada
  佐々木Sasaki 山口Yamaguchi 松本Matsumoto 井上Inoue 木村Kimura 清水Shimizu 山崎Yamazaki 森Mori 池田Ikeda 橋本Hashimoto 阿部Abe
  石川Ishikawa 前田Maeda 藤田Fujita 小川Ogawa 岡田Okada 後藤Goto 長谷川Hasegawa 村上Murakami 近藤Kondo 石井Ishii 坂本Sakamoto
  遠藤Endo 青木Aoki 藤井Fujii 西村Nishimura 福田Fukuda 太田Ota 三浦Miura
  武Takeshi 茂Shigeru 勇Isamu 清Kiyoshi 勝Masaru 博Hiroshi 実Minoru 正雄Masao 一郎Ichiro 健一Kenichi 昭Akira 進Susumu 三郎Saburo
  秀夫Hideo 大輔Daisuke 健太Kenta 誠Makoto 剛Tsuyoshi 浩二Koji 正樹Masaki 直樹Naoki 隆Takashi 達也Tatsuya 和也Kazuya 修Osamu
  智之Tomoyuki 亮Ryo 健二Kenji 翔太Shota 蓮Ren 大翔Hiroto 悠真Yuma 陽斗Haruto 湊Minato 颯太Sota 拓海Takumi 健Ken 翼Tsubasa
  陸Riku 樹Itsuki 悠斗Yuto 海斗Kaito 和子Kazuko 洋子Yoko 幸子Sachiko 節子Setsuko 久美子Kumiko 恵子Keiko 明美Akemi 順子Junko
  美代子Miyoko 良子Yoshiko 由美Yumi 直美Naomi 裕子Yuko 智子Tomoko 真由美Mayumi 香織Kaori 美穂Miho 恵Megumi 理恵Rie 亜希子Akiko
  美咲Misaki さくらSakura 陽菜Hina 結衣Yui 葵Aoi 凛Rin 花Hana 芽衣Mei 彩Aya 莉子Riko 美月Mizuki 杏An`)
export const TW_ROMAN: Record<string, string> = romaji(`
  陳Chen 林Lin 黃Huang 張Chang 李Lee 王Wang 吳Wu 劉Liu 蔡Tsai 楊Yang 許Hsu 鄭Cheng 謝Hsieh 郭Kuo 洪Hung 曾Tseng 邱Chiu 廖Liao
  賴Lai 周Chou 徐Hsu 蘇Su 葉Yeh 莊Chuang 呂Lu 江Chiang 何Ho 蕭Hsiao 羅Lo 高Kao 潘Pan 簡Chien 朱Chu 鍾Chung 彭Peng 游Yu 詹Chan
  胡Hu 施Shih 沈Shen 余Yu 盧Lu 梁Liang 趙Chao 顏Yen 柯Ko 翁Weng 魏Wei 孫Sun 戴Tai
  德Te 國Kuo 金Chin 永Yung 清Ching 文Wen 明Ming 正Cheng 榮Jung 春Chun 福Fu 雄Hsiung 財Tsai 輝Hui 隆Lung 發Fa 昌Chang 義Yi 仁Jen
  生Sheng 志Chih 建Chien 家Chia 俊Chun 宗Tsung 冠Kuan 政Cheng 嘉Chia 信Hsin 世Shih 振Chen 育Yu 立Li 宏Hung 豪Hao 傑Chieh 翰Han
  哲Che 偉Wei 華Hua 誠Cheng 銘Ming 峰Feng 賢Hsien 強Chiang 鈞Chun 子Tzu 宇Yu 承Cheng 品Pin 柏Po 彥Yen 宥Yu 睿Jui 浩Hao 博Po
  恩En 翔Hsiang 廷Ting 霖Lin 安An 凱Kai 瑋Wei 辰Chen 叡Jui 勳Hsun 秀Hsiu 玉Yu 美Mei 淑Shu 麗Li 月Yueh 素Su 寶Pao 蘭Lan 芬Fen
  珠Chu 英Ying 琴Chin 霞Hsia 鳳Feng 雲Yun 娥O 雅Ya 怡Yi 佳Chia 佩Pei 惠Hui 曉Hsiao 靜Ching 慧Hui 婉Wan 宜Yi 婷Ting 君Chun 琪Chi
  玲Ling 雯Wen 娟Chuan 如Ju 萍Ping 心Hsin 依Yi 筱Hsiao 詩Shih 語Yu 欣Hsin 芷Chih 思Szu 于Yu 涵Han 萱Hsuan 妤Yu 彤Tung 晴Ching
  瑄Hsuan 柔Jou 璇Hsuan 甯Ning 潔Chieh 庭Ting`)

/** someone's name in the page's language (in English spelled out from the Chinese or Japanese; a character with no
 * spelling, as it is) */
export function personName(w: { zh: string; ja: string }, lang: 'zh' | 'ja' | 'en') {
  if (lang === 'ja') return w.ja
  if (lang !== 'en') return w.zh
  const jp = w.zh.split(' ')
  if (jp.length === 2) return `${JP_ROMAJI[jp[1]] ?? jp[1]} ${JP_ROMAJI[jp[0]] ?? jp[0]}`
  const [sur, ...given] = [...w.zh]
  const g = given.map((c) => (TW_ROMAN[c] ?? c).toLowerCase()).join('-')
  return `${g ? g[0].toUpperCase() + g.slice(1) + ' ' : ''}${TW_ROMAN[sur] ?? sur}`
}
