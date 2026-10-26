import type { Lang } from './i18n'

/**
 * The till register's operating manual (the booklet on the boxes under the till), page by page: Chinese and Japanese. Each page a heading
 * and its steps; a step is a key (or keys) and what it does.
 */
export interface ManualPage { title: Record<Lang, string>; steps: { keys: string; text: Record<Lang, string> }[] }

export const REGISTER_MANUAL: ManualPage[] = [
  {
    title: { zh: '1　開機與模式鎖', ja: '1　電源とモードキー' },
    steps: [
      { keys: 'OFF', text: { zh: '關機：顯示幕全暗，按什麼都沒反應。', ja: '電源オフ：表示が消え、キーは効きません。' } },
      { keys: 'REG', text: { zh: '營業：平常收銀就轉到這一格。', ja: '登録：ふだんの会計はこの位置。' } },
      { keys: 'X', text: { zh: '點檢：顯示今天的營業額；按「CASH/TEND」印出 X 報表，數字不歸零。', ja: '点検：本日の売上を表示。現計キーで X レポート（リセットなし）。' } },
      { keys: 'Z', text: { zh: '精算：打烊時用。按「CASH/TEND」印出 Z 報表，營業額歸零。', ja: '精算：閉店時に。現計キーで Z レポートを印字し、売上をゼロに。' } },
      { keys: '模式鎖', text: { zh: '點一下鑰匙就轉到下一格（OFF → REG → X → Z）。', ja: 'キーをクリックするたびに次の位置へ。' } },
    ],
  },
  {
    title: { zh: '2　登錄品項', ja: '2　商品の登録' },
    steps: [
      { keys: '數字 → 部門 1–4', text: { zh: '先輸入金額，再按部門鍵，就登錄一筆。部門 1 燒烤、2 飲料、3 定食、4 小菜。', ja: '金額を入れて部門キー。1 焼き物・2 飲み物・3 定食・4 小鉢。' } },
      { keys: '部門 1–4', text: { zh: '不輸入金額直接按，用該部門的預設價格（¥380 / 320 / 500 / 100）。', ja: '金額なしで押すと部門の設定価格。' } },
      { keys: '數字 → PLU', text: { zh: '輸入商品代碼再按 PLU：1 鹽烤香魚、2 烤秋刀魚、3 烤飯糰、4 生啤酒、5 烏龍茶。', ja: 'コードを入れて PLU。1 鮎・2 秋刀魚・3 焼きおにぎり・4 生ビール・5 烏龍茶。' } },
      { keys: '數字 → X/TIME', text: { zh: '先輸入數量按 X/TIME，下一筆就乘上數量（例：3 X/TIME 380 部門1 = 1,140）。', ja: '数量を入れて ×、次の登録に掛けます。' } },
      { keys: 'X/TIME', text: { zh: '沒輸入數字時按，顯示現在時間。', ja: '数字なしで押すと時刻を表示。' } },
    ],
  },
  {
    title: { zh: '3　更正、折扣、退貨', ja: '3　訂正・割引・返品' },
    steps: [
      { keys: 'CLEAR', text: { zh: '清掉剛輸入、還沒登錄的數字。', ja: '入力中の数字を消す。' } },
      { keys: 'VOID', text: { zh: '刪掉最後一筆。', ja: '直前の登録を取り消す。' } },
      { keys: 'CANCEL', text: { zh: '整筆交易作廢。', ja: '取引全体を取り消す。' } },
      { keys: '− % / + %', text: { zh: '最後一筆打折或加成；先輸入百分比，不輸入就是 10%。', ja: '直前の品を割引・割増（未入力は 10%）。' } },
      { keys: 'RETURN', text: { zh: '退貨：下一筆會變成負的金額。', ja: '返品：次の登録がマイナスに。' } },
    ],
  },
  {
    title: { zh: '4　結帳', ja: '4　会計' },
    steps: [
      { keys: 'SUBTOTAL', text: { zh: '顯示目前總額（顯示幕左上亮「小計」）。', ja: '小計を表示。' } },
      { keys: 'TAX', text: { zh: '顯示總額裡含的 10% 消費稅。', ja: '内税（10%）を表示。' } },
      { keys: '數字 → CASH/TEND', text: { zh: '輸入客人給的錢再按：顯示找零、抽屜彈出、印發票。錢不夠會嗶一聲顯示 E。', ja: '預り金を入れて現計：お釣り表示・ドロアが開き・レシート。不足なら E。' } },
      { keys: 'CASH/TEND', text: { zh: '不輸入直接按，就是剛好付清。', ja: 'そのまま押すとちょうど払い。' } },
      { keys: 'CHECK / CHARGE', text: { zh: '支票結帳（開抽屜）／簽帳結帳（不開抽屜），都不找零。', ja: '小切手（ドロア開）／掛売り（ドロア閉）。' } },
      { keys: 'RCPT ON-OFF', text: { zh: '切換結帳時要不要印發票（顯示幕亮「發票」與 ON / OFF）。', ja: 'レシート発行の切替。' } },
      { keys: 'FEED', text: { zh: '走紙：送出一段空白的紙。', ja: '紙送り。' } },
      { keys: '發票', text: { zh: '印好的發票掛在出紙口，點一下撕掉。', ja: 'レシートはクリックで切り取り。' } },
    ],
  },
  {
    title: { zh: '5　抽屜與鑰匙', ja: '5　ドロアと鍵' },
    steps: [
      { keys: '抽屜', text: { zh: '點抽屜正面拉開，再點一下推回去。', ja: 'ドロアの前面をクリックで開閉。' } },
      { keys: '抽屜鑰匙', text: { zh: '鑰匙直的是開鎖、橫的是上鎖。上鎖時抽屜打不開，只會卡一下（顯示幕亮「鎖」），交易仍照常記帳。', ja: '鍵が横で施錠。施錠中は開かず「鎖」を表示（会計は記録されます）。' } },
      { keys: 'NO SALE', text: { zh: '沒有交易時打開抽屜（換零錢用）。交易進行中不能按。', ja: '取引なしでドロアを開ける（両替など）。' } },
      { keys: '數字 → RA+ / PO−', text: { zh: '入金：把零用金放進抽屜；出金：從抽屜拿錢付款。都會開抽屜、印單子。', ja: '入金・出金。ドロアが開き伝票を印字。' } },
      { keys: '數字 → CLERK', text: { zh: '換當班店員，之後的發票印上店員號碼。', ja: '担当者番号の切替。' } },
    ],
  },
  {
    title: { zh: '6　計算機與顯示幕', ja: '6　電卓と表示' },
    steps: [
      { keys: 'CALC', text: { zh: '切換成計算機：+% 加、−% 減、X/TIME 乘、SUBTOTAL 等於，算的結果不會記帳。再按一次回到收銀。', ja: '電卓モード：+% 足す・−% 引く・× 掛ける・小計 ＝。' } },
      { keys: '顯示幕小字', text: { zh: '品項／小計／合計／找零／數量／時刻／稅／計算／錯誤／退貨／店員／發票／入金／出金／鎖：說明現在顯示的數字是什麼。', ja: '表示の左上の文字は、数字の意味を示します。' } },
      { keys: 'E', text: { zh: '按錯（例如錢不夠、日圓按小數點）會低音嗶一聲並顯示 E，按 CLEAR 繼續。', ja: 'エラーは低いブザーと E。CLEAR で続行。' } },
    ],
  },
]
