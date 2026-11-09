import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { IDLE_TIRE, LATE_TIRE, ROLES, SKILLS, SLACK_AFTER, TIER_ODDS, TIRED_AT, activityOf, effective, fair, paceBoost, paceOf, restPerHour, tireNow, tirePerHour, workFatigue, type SkillId, type Worker } from '@/data/staff'
import { STAFF_IDLE, idleTick } from '@/game/shopState'
import { CANDIDATES, ROLLS_PER_DAY, canDismiss, canHire, makeCandidates, pickHires, refreshApplicants, replaceOf, seeded, skillDraw, statScore, valueOf, wageOf } from '@/game/hiring'

feature('員工與徵人', () => {
  scenario('營業中不能解雇員工，閉店後才可以', ({ given, when, then, and }) => {
    given('店正在營業', (w) => { w.open = true })
    when('老闆想解雇一位員工', (w) => { w.ok = canDismiss(w.open) })
    then('不能解雇（客人還在，人手不能說走就走）', (w) => { expect(w.ok).toBe(false) })
    and('閉店後就可以解雇', () => { expect(canDismiss(false)).toBe(true) })
  })

  scenario('營業中仍可臨時加派人手', ({ then }) => {
    then('開店或閉店都能雇人', () => { expect(canHire(true)).toBe(true); expect(canHire(false)).toBe(true) })
  })

  scenario('疲勞值到了，能力就減半', ({ given, when, then, and }) => {
    given('一位技能 80 的員工', (w) => { w.w = { skill: 80 } as Worker })
    when(`看他精神飽滿、快累了（${TIRED_AT - 1}）與疲勞（${TIRED_AT}）的表現`, (w) => { w.fresh = effective(w.w, 0); w.almost = effective(w.w, TIRED_AT - 1); w.tired = effective(w.w, TIRED_AT) })
    then('還沒到疲勞照常', (w) => { expect(w.almost).toBe(w.fresh) })
    and('疲勞了只剩一半', (w) => { expect(w.tired).toBeCloseTo(w.fresh / 2, 6) })
    and('走路、做事的速度也是一半', () => { expect(paceOf(TIRED_AT - 1)).toBe(1); expect(paceOf(TIRED_AT)).toBe(0.5) })
  })

  scenario('體力低的人累得比較快', ({ given, when, then, and }) => {
    given('體力 90 和體力 30 的兩個人', (w) => { w.a = { stamina: 90 } as Worker; w.b = { stamina: 30 } as Worker })
    when('比較每營業一小時增加的疲勞', (w) => { w.ta = tirePerHour(w.a); w.tb = tirePerHour(w.b) })
    then('體力低的累得比較快', (w) => { expect(w.tb).toBeGreaterThan(w.ta) })
    and('體力 30 的不到半個班（6 小時）就累了；12 小時的班做完，連體力 90 的也會累', (w) => { expect(6 * w.tb).toBeGreaterThanOrEqual(TIRED_AT); expect(6 * w.ta).toBeLessThan(TIRED_AT); expect(12 * w.ta).toBeGreaterThanOrEqual(TIRED_AT) })
    and('閉店的 12 小時一定恢復到精神飽滿', () => { expect(12 * restPerHour).toBeGreaterThanOrEqual(100) })
  })

  scenario('過了午夜進入深夜模式，疲勞加劇', ({ given, then, but }) => {
    given('一位體力 80 的一般員工', (w) => { w.w = { stamina: 80 } as Worker })
    then(`深夜每小時累積的是平常的 ${LATE_TIRE} 倍`, (w) => { expect(tireNow(w.w, true)).toBeCloseTo(tirePerHour(w.w) * LATE_TIRE, 6) })
    but('午夜前照常', (w) => { expect(tireNow(w.w, false)).toBe(tirePerHour(w.w)) })
  })

  scenario('夜貓子（菁英）在深夜發動特殊效果', ({ given, then, and, but }) => {
    given('一位技能 80、體力 80 的夜貓子', (w) => { w.w = { skill: 80, stamina: 80, skills: ['nightOwl'] } as Worker })
    then('深夜工作效率與速度 ×1.25', (w) => { expect(effective(w.w, 0, true)).toBeCloseTo(effective(w.w, 0, false) * 1.25, 6); expect(paceOf(0, paceBoost(w.w, true))).toBe(1.25) })
    and('疲勞不受深夜加劇', (w) => { expect(tireNow(w.w, true)).toBe(tirePerHour(w.w)) })
    and('品質是菁英', () => { expect(SKILLS.nightOwl.tier).toBe('elite') })
    but('累了一樣減半（再乘夜貓子的加成）', (w) => { expect(effective(w.w, TIRED_AT, true)).toBeCloseTo(0.8 * 0.5 * 1.25, 6) })
  })

  scenario('特殊技能分四種品質，各自的效果', ({ given, then, and }) => {
    given('同樣技能 80、體力 80 的四個人', (w) => { const one = (k: SkillId) => ({ skill: 80, stamina: 80, skills: [k] }) as Worker; w.plain = { skill: 80, stamina: 80 } as Worker; w.craft = one('craftsman'); w.iron = one('ironMan'); w.king = one('prodigy') })
    then('職人魂（菁英）工作能力 ×1.15', (w) => { expect(effective(w.craft, 0)).toBeCloseTo(effective(w.plain, 0) * 1.15, 6) })
    and('鐵人（稀有）疲勞只累積 0.6', (w) => { expect(tireNow(w.iron, false)).toBeCloseTo(tirePerHour(w.iron) * 0.6, 6) })
    and('天才（極品）能力 ×1.3、速度 ×1.15、疲勞 ×0.8', (w) => {
      expect(effective(w.king, 0)).toBeCloseTo(effective(w.plain, 0) * 1.3, 6)
      expect(paceBoost(w.king, false)).toBeCloseTo(1.15, 6)
      expect(tireNow(w.king, false)).toBeCloseTo(tirePerHour(w.king) * 0.8, 6)
    })
    and('每一種品質至少有一個技能', () => { for (const t of ['special', 'elite', 'rare', 'legend']) expect(Object.values(SKILLS).some((k) => k.tier === t)).toBe(true) })
  })

  scenario('特殊技能隨機賦予，越好的越少見', ({ when, then, and }) => {
    when('抽兩萬位應徵者', (w) => {
      const r = seeded(7), n: Record<string, number> = { none: 0, special: 0, elite: 0, rare: 0, legend: 0 }
      for (let i = 0; i < 20000; i++) { const k = skillDraw(r)[0]; n[k ? SKILLS[k].tier : 'none']++ }
      w.n = n
    })
    then('大多數人沒有技能', (w) => { expect(w.n.none / 20000).toBeGreaterThan(0.6) })
    and('特殊 > 菁英 > 稀有 > 極品', (w) => { expect(w.n.special).toBeGreaterThan(w.n.elite); expect(w.n.elite).toBeGreaterThan(w.n.rare); expect(w.n.rare).toBeGreaterThan(w.n.legend); expect(w.n.legend).toBeGreaterThan(0) })
    and('跟設定的機率差不多', (w) => { for (const t of ['special', 'elite', 'rare', 'legend'] as const) expect(Math.abs(w.n[t] / 20000 - TIER_ODDS[t])).toBeLessThan(0.01) })
  })

  scenario('價碼照數值走：數值越高越貴，技能純憑運氣不影響價碼', ({ then, and }) => {
    then('同一個職位，手藝、速度、體力越高，價碼越高', () => {
      expect(wageOf('chef', { skill: 85, speed: 70, stamina: 70 })).toBeGreaterThan(wageOf('chef', { skill: 60, speed: 70, stamina: 70 }))
      expect(wageOf('server', { skill: 70, speed: 90, stamina: 90 })).toBeGreaterThan(wageOf('server', { skill: 70, speed: 60, stamina: 60 }))
    })
    and('一整批應徵者：數值分數高的那一半，平均價碼比低的那一半貴', () => {
      const ws = makeCandidates('grilledfish', seeded(11)).filter((w) => w.role === 'server').sort((a, b) => (a.skill + a.speed + a.stamina) - (b.skill + b.speed + b.stamina))
      const avg = (xs: Worker[]) => xs.reduce((n, w) => n + w.wage, 0) / xs.length
      expect(avg(ws.slice(ws.length / 2))).toBeGreaterThan(avg(ws.slice(0, ws.length / 2)))
    })
    and('價碼只看數值，有沒有技能都一樣', () => {
      const r = seeded(3), ws = makeCandidates('grilledfish', r)
      for (const w of ws) expect(Math.abs(w.wage - wageOf(w.role, w))).toBeLessThanOrEqual(wageOf(w.role, w) * 0.03 + 5)
    })
  })

  scenario(`應徵名單每天更新，另外每天有 ${ROLLS_PER_DAY} 次骰子可以重新刷新`, ({ given, when, then, and }) => {
    given('一份應徵名單，雇了其中一位', (w) => { w.before = [...CANDIDATES.grilledfish]; w.kept = w.before[0].id })
    when('換一批', (w) => { refreshApplicants('grilledfish', (id) => id === w.kept, 'd2', seeded(5)); w.after = CANDIDATES.grilledfish })
    then('雇用的人還在', (w) => { expect(w.after.some((x: Worker) => x.id === w.kept)).toBe(true) })
    and('其他人都換成新的，編號不重複', (w) => {
      const old = new Set(w.before.map((x: Worker) => x.id))
      const fresh = w.after.filter((x: Worker) => x.id !== w.kept)
      expect(fresh.every((x: Worker) => !old.has(x.id))).toBe(true)
      expect(new Set(w.after.map((x: Worker) => x.id)).size).toBe(w.after.length)
    })
    and('每天兩次骰子', () => { expect(ROLLS_PER_DAY).toBe(2) })
  })

  scenario('應徵的人夠多可以挑：每個職位至少是名額的 4 倍，掌爐的師傅（二廚）至少 8 位', ({ given, then, and }) => {
    given('新開一局，日式烤魚店來應徵的人', (w) => { w.people = makeCandidates('grilledfish', seeded(11)); w.roles = ROLES.grilledfish })
    then('每個職位的應徵者至少是名額的 4 倍', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) expect((w.people as Worker[]).filter((p) => p.role === r.role).length, r.role).toBeGreaterThanOrEqual(r.max * 4)
    })
    and('二廚（掌爐的師傅）至少 8 位，老中青都有', (w) => {
      const chefs = (w.people as Worker[]).filter((p) => p.role === 'chef')
      expect(chefs.length).toBeGreaterThanOrEqual(8)
      expect(new Set(chefs.map((c) => c.look.age)).size).toBe(3)
    })
    and('名字都不一樣，大部分人的經歷也不一樣', (w) => {
      const people = w.people as Worker[]
      expect(new Set(people.map((p) => p.zh)).size).toBe(people.length)
      const lines = people.map((p) => p.note.split('，')[0])
      expect(new Set(lines).size).toBeGreaterThanOrEqual(people.length * 0.6)
    })
  })

  scenario('合理薪資不低於基本工資，技能越高越貴', ({ when, then }) => {
    when('求各職位技能 0 與 100 的合理時薪', (w) => {
      w.rows = (['chef', 'sous', 'server', 'stock', 'cashier'] as const).map((r) => [fair(r, 0), fair(r, 100)])
    })
    then('技能 0 時接近基本工資 196，技能 100 時更高', (w) => {
      for (const [lo, hi] of w.rows as [number, number][]) { expect(lo).toBeGreaterThanOrEqual(195); expect(hi).toBeGreaterThan(lo) }
    })
  })

  scenario('一鍵徵人只挑 CP 值最高的，而且不超過職位名額', ({ given, when, then }) => {
    given('日式烤魚店的一批應徵者，沒有人被雇用', (w) => {
      w.people = makeCandidates('grilledfish', seeded(42))
      w.roles = ROLES.grilledfish
    })
    when('一鍵徵人', (w) => { w.hires = pickHires(w.people, w.roles, {}) as Worker[] })
    then('每個職位被選的人數不超過名額', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) expect((w.hires as Worker[]).filter((h) => h.role === r.role).length).toBeLessThanOrEqual(r.max)
    })
    then('每個職位選到的是該職位 CP 值最高的人', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) {
        const pool = (w.people as Worker[]).filter((p) => p.role === r.role).sort((a, b) => valueOf(b) - valueOf(a))
        const got = (w.hires as Worker[]).filter((h) => h.role === r.role)
        expect(got.map((g) => g.id)).toEqual(pool.slice(0, got.length).map((g) => g.id))
      }
    })
  })

  scenario('名額已經滿了的職位不再徵人', ({ given, when, then }) => {
    given('每個職位都已經雇滿', (w) => {
      w.people = makeCandidates('grilledfish', seeded(7)); w.roles = ROLES.grilledfish
      w.hired = {} as Record<string, boolean>
      for (const r of w.roles as { role: string; max: number }[]) (w.people as Worker[]).filter((p) => p.role === r.role).slice(0, r.max).forEach((p) => { w.hired[p.id] = true })
    })
    when('再一鍵徵人', (w) => { w.more = pickHires(w.people, w.roles, w.hired) })
    then('沒有人被加進來', (w) => { expect(w.more).toEqual([]) })
  })

  scenario('滿員時雇用應徵者，替換掉同職位裡能力最弱的那位', ({ given, when, then, and }) => {
    given('外場已經雇滿', (w) => {
      w.people = makeCandidates('grilledfish', seeded(11))
      w.mine = (w.people as Worker[]).filter((p) => p.role === 'server').slice(0, 4)
      w.newcomer = (w.people as Worker[]).filter((p) => p.role === 'server')[5]
    })
    when('雇用一位新的外場並替換', (w) => { w.out = replaceOf(w.mine) })
    then('被換掉的是在職外場裡手藝、速度、體力綜合最低的', (w) => {
      const low = Math.min(...(w.mine as Worker[]).map(statScore))
      expect(statScore(w.out)).toBe(low)
    })
    and('沒有人在職時沒有人可換', () => { expect(replaceOf([])).toBeNull() })
  })
})

feature('上班時忙、待命、偷閒的疲勞不同（店主要的）', () => {
  scenario('忙的時候照常累積，待命時累積得很慢', ({ then, and }) => {
    then('忙一小時：疲勞多一小時的量', () => { expect(workFatigue(20, 10, 'busy', 1)).toBe(30) })
    and(`待命一小時：只多 ${IDLE_TIRE * 100}%`, () => { expect(workFatigue(20, 10, 'idle', 1)).toBeCloseTo(20 + 10 * IDLE_TIRE, 5) })
  })
  scenario('沒事做久了就偷閒，疲勞反而慢慢回復一些', ({ then, and }) => {
    then(`沒事做 ${SLACK_AFTER} 秒以內是待命，之後是偷閒`, () => {
      expect(activityOf(undefined)).toBe('busy')
      expect(activityOf(SLACK_AFTER - 1)).toBe('idle')
      expect(activityOf(SLACK_AFTER)).toBe('slack')
    })
    and('偷閒一小時：疲勞少了，但比休息恢復得慢', () => {
      const f = workFatigue(50, 10, 'slack', 1)
      expect(f).toBeLessThan(50)
      expect(50 - f).toBeLessThan(restPerHour)
    })
    and('不會低於 0', () => { expect(workFatigue(1, 10, 'slack', 5)).toBe(0) })
  })
})

feature('偷閒只限倉儲（店主要的，2026-11-10）', () => {
  scenario('其他人沒事做只會待命，不會偷閒', ({ given, when, then, and }) => {
    given('一位外場、一位倉儲都沒事做', () => { STAFF_IDLE.clear() })
    when(`都過了 ${SLACK_AFTER * 3} 秒`, () => { idleTick('server-x', true, SLACK_AFTER * 3); idleTick('stock-x', true, SLACK_AFTER * 3, true) })
    then('外場還是待命', () => { expect(activityOf(STAFF_IDLE.get('server-x'))).toBe('idle') })
    and('倉儲在偷閒', () => { expect(activityOf(STAFF_IDLE.get('stock-x'))).toBe('slack') })
    and('有事做了就都不算閒著', () => { idleTick('stock-x', false, 1); expect(activityOf(STAFF_IDLE.get('stock-x'))).toBe('busy') })
  })
})
