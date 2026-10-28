import type { Lang } from './i18n'

/**
 * What each of the till register's keys does, as shown when the pointer's on it: Chinese and Japanese. `{name}` and `{price}` are filled in
 * with a department key's name and set price.
 */
/** (English where it's been written; the rest falls back to the Chinese) */
type Help = { zh: string; ja: string; en?: string }
const DIGIT: Help = { zh: '數字：輸入金額、數量或代碼', ja: '数字：金額・数量・コードを入力' }
export const KEY_HELP: Record<string, Help> = {
  ...Object.fromEntries(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '00'].map((k) => [k, DIGIT])),
  DOT: { zh: '小數點（只在計算機模式；日圓沒有小數）', ja: '小数点（電卓モードのみ）' },
  CLEAR: { zh: 'CLEAR：清掉剛輸入的數字', ja: 'クリア：入力した数字を消す' },
  DEPT: { zh: '部門・{name}：登錄輸入的金額，沒輸入就用 ¥{price}', ja: '部門・{name}：入力額を登録（未入力なら ¥{price}）' },
  PLU: { zh: 'PLU：輸入商品代碼再按，登錄那道菜', ja: 'PLU：商品コードを入れて押すと登録' },
  XTIME: { zh: '× / 時刻：先輸入數量再按，下一筆乘上數量；沒輸入就顯示時間', ja: '× / 時刻：数量を入れて押すと次の品を掛ける。未入力なら時刻' },
  RCPT: { zh: '發票開關：結帳時要不要印發票', ja: 'レシート ON/OFF' },
  NOSALE: { zh: '開抽屜（NO SALE）：沒有交易時打開抽屜', ja: 'ノーセール：取引なしでドロアを開ける' },
  CALC: { zh: '計算機：切換成計算機（+% 加、−% 減、× 乘、小計 =）', ja: '電卓モードの切り替え' },
  RETURN: { zh: '退貨：下一筆變成退款（負的）', ja: '返品：次の登録をマイナスに' },
  VOID: { zh: '更正：刪掉最後一筆', ja: '訂正：直前の登録を取り消す' },
  CANCEL: { zh: '取消：清掉整筆交易', ja: '取消：取引全体を取り消す' },
  TAX: { zh: '稅：顯示小計裡含的 10% 消費稅', ja: '税：小計に含まれる消費税（10%）' },
  CLERK: { zh: '店員：輸入店員號碼再按，發票印上這位店員', ja: '担当者：番号を入れて押す' },
  PCTMINUS: { zh: '−%：最後一筆打折（沒輸入就是 10%）', ja: '−%：直前の品を割引（未入力は10%）' },
  PCTPLUS: { zh: '+%：最後一筆加成', ja: '+%：直前の品に割増' },
  FEED: { zh: '走紙：送出一段空白的紙', ja: '紙送り' },
  RA: { zh: '入金 RA+：輸入金額，把零用金放進抽屜', ja: '入金：釣銭準備金を入れる' },
  PO: { zh: '出金 PO−：輸入金額，從抽屜拿錢出去', ja: '出金：ドロアから支払う' },
  CHECK: { zh: '支票結帳：收支票，抽屜打開', ja: '小切手で締める' },
  CHARGE: { zh: '簽帳結帳：記帳，抽屜不開', ja: '掛売りで締める（ドロアは開かない）' },
  SUBTOTAL: { zh: '小計：顯示目前的總額', ja: '小計' },
  CASH: { zh: '現金結帳：輸入收到的錢再按，顯示找零、開抽屜、印發票；沒輸入就是剛好付清', ja: '現計：預り金を入れて押すとお釣り表示・ドロア・レシート' },
  MODE: { zh: '模式鎖（點一下轉到下一格）：OFF 關機／REG 營業／X 看今日營業額／Z 結算並歸零', ja: 'モードキー：OFF／REG 登録／X 点検／Z 精算' },
  DRAWER_KEY: { zh: '抽屜鑰匙（點一下轉）：直的是開鎖，橫的是上鎖，上鎖時抽屜打不開', ja: 'ドロアの鍵：横にすると施錠、開かなくなる' },
}
/** a key's help, in the language, with a department's name and price put in */
export function keyHelp(id: string, lang: Lang, dept?: { name: string; price: number }) {
  const h = KEY_HELP[/^D\d$/.test(id) ? 'DEPT' : id]
  if (!h) return ''
  return (h[lang] ?? h.zh).replace('{name}', dept?.name ?? '').replace('{price}', String(dept?.price ?? ''))
}
