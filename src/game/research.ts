// Working out the menu: what a shop's foods could be made into, and how good each ought to come out.
import type { Dish } from '@/data/menu'
import { SEASONINGS, type Seasoning, type Topping } from '@/data/recipes'
import type { Lang } from '@/data/i18n'
import type { Stage, Step } from '@/game/types'
import { bestStage, breadTaste, PAIRING, PAIRING_DEFAULT, timingLoss } from '@/game/taste'

export type Idea = { id: string; dabs: Seasoning[]; taste: number }

/**
 * Every dish a cook could try at a shop, with how good it ought to come out made well: at the grill each food plain
 * and with each seasoning that suits it; at the bakery each dough plain and with each filling that suits it;
 * elsewhere each soup, bowl and side as it comes.
 */
export function trialIdeas(d: Dish): Idea[] {
  const ideas: Idea[] = []
  if (d.roast) {
    for (const it of d.items) {
      if (!(it.id in d.roast.times)) continue
      ideas.push({ id: it.id, dabs: [], taste: 62 })
      const good = (SEASONINGS as (keyof typeof PAIRING)[]).map((k) => ({ k, w: PAIRING[k][it.id] ?? PAIRING_DEFAULT[k] }))
        .filter((x) => x.w > 5).sort((a, b) => b.w - a.w)
      for (const { k, w } of good) ideas.push({ id: it.id, dabs: [k], taste: 62 + w })
      // and two that both suit it, the better first (鹽烤秋刀魚佐檸檬, 醬烤雞肉串撒七味…)
      for (let i = 0; i < good.length; i++) for (let j = i + 1; j < good.length; j++) {
        ideas.push({ id: it.id, dabs: [good[i].k, good[j].k], taste: Math.min(98, 62 + good[i].w + good[j].w * 0.6) })
      }
    }
  } else if (d.bake) {
    for (const it of d.items) {
      ideas.push({ id: it.id, dabs: [], taste: breadTaste(d.bake, it.id, [], 1.1) })
      for (const [k, w] of Object.entries(d.bake.pairing[it.id] ?? {})) {
        if ((w ?? 0) > 5) ideas.push({ id: it.id, dabs: [k as Topping], taste: breadTaste(d.bake, it.id, [k as Topping], 1.1) })
      }
    }
  } else {
    for (const it of [...d.bases.filter((b) => !b.includes || d.id === 'beefnoodle'), ...d.items]) ideas.push({ id: it.id, dabs: [], taste: 72 })
  }
  return ideas
}

const STAGE_WORD: Record<Lang, Record<Stage, string>> = {
  zh: { before: '上火前', early: '烤到一半時', late: '起鍋前', after: '起鍋後' },
  ja: { before: '焼く前に', early: '焼いている途中で', late: '焼き上がり直前に', after: '焼き上がってから' },
}
/** how each seasoning is put on, in words: 撒鹽, 刷醬油, 抹味噌… */
const HOW: Record<Lang, Record<string, string>> = {
  zh: { salt: '撒鹽', soy: '刷醬油', milk: '淋煉乳', peanut: '撒花生粉', miso: '抹味噌', wasabi: '配一點山葵', shichimi: '撒七味粉',
    yuzu: '點柚子胡椒', lemon: '擠檸檬汁', water: '灑水' },
  ja: { salt: '塩を振る', soy: '醤油を塗る', milk: '練乳をかける', peanut: 'きな粉を振る', miso: '味噌を塗る', wasabi: 'わさびを添える',
    shichimi: '七味を振る', yuzu: '柚子胡椒を添える', lemon: 'レモンを搾る', water: '水を打つ' },
}
/**
 * A dish written out as a recipe, step by step in the order it's done: what goes on before the fire, the cooking
 * itself (how long over a medium fire, and to what doneness), what goes on just before it comes off, and what's
 * added after. secs: its cook-time at a medium fire; done: the word for how done (剛好…).
 */
export function recipeSteps(steps: Step[], secs: number, done: string, lang: Lang): string[] {
  const at = (st: Stage) => steps.filter((x) => x.at === st).map((x) => `${STAGE_WORD[lang][st]}${HOW[lang][x.k] ?? x.k}`)
  const fire = lang === 'ja' ? `中火で約${secs}秒、${done}に焼く` : `中火烤約 ${secs} 秒，烤到${done}`
  return [...at('before'), ...at('early'), fire, ...at('late'), ...at('after')]
}
/** the steps for a dish made the way each of its seasonings is best put on */
export const idealSteps = (dabs: string[]): Step[] => dabs.map((k) => ({ k, at: bestStage(k) }))

/** a word of advice for each seasoning put on at the wrong time: 「醬油最好起鍋前再刷」 */
export function timingTips(steps: Step[], lang: Lang): string[] {
  return steps.filter((x, i) => steps.findIndex((y) => y.k === x.k) === i && timingLoss(x.k, x.at) > 0)
    .map((x) => lang === 'ja' ? `${HOW.ja[x.k] ?? x.k}のは${STAGE_WORD.ja[bestStage(x.k)]}がいい`
      : `${HOW.zh[x.k] ?? x.k}最好在${STAGE_WORD.zh[bestStage(x.k)]}`)
}
