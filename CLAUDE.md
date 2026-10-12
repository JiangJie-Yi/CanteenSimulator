# JapaneseGrillSimulator 日式燒烤模擬器：開發守則

React 19 + TypeScript + Vite + three.js（@react-three/fiber / drei）。推到 `main` 就會由 GitHub Actions 測試、建置，並部署到 GitHub Pages。

目前只開放日式烤魚（`data/menu.ts` 的 `ENABLED_SHOPS`），新遊戲直接進到已開業的烤魚店；其他三間店的資料都還在（`ALL_DISHES`），單元測試仍會檢查全部四間。

## 資料夾分類（依賴只能往左）

```
data  ←  game  ←  scene  ←  ui  ←  shops/*  ←  App.tsx
```

| 資料夾 | 放什麼 | 可以引用 |
|---|---|---|
| `src/data/` | 靜態資料：菜單與食材（`menu.ts`）、菜名與調味（`recipes.ts`）、員工（`staff.ts`、`chefs.ts`）、客人（`guests.ts`）、台詞（`lines.ts`）、介面文字（`i18n.ts`） | 只能引用 data |
| `src/game/` | **純邏輯**（不碰 React 和 three）：成本與庫存（`economy.ts`）、口味與評分（`taste.ts`）、研發與試做（`research.ts`）、共用型別（`types.ts`） | data |
| `src/scene/` | 各店共用的 3D 元件：`Dish`、`Steam`、`OpeningSpot`、裝置等級（`quality.ts`）、shader | data、game |
| `src/ui/` | 2D 介面：菜單板、研發筆記、辦公室、歡迎頁、表情、頭像…… | data、game、scene |
| `src/shops/<店>/` | 每間店自己的 3D 與互動：`grill`（烤魚，Roasting）、`hotpot`（火鍋）、`noodle`（台式麵食）、`bakery`（麵包） | data、game、scene、ui |
| `src/App.tsx` | 把各部分組起來：存檔、帳本、營業模擬的計時器、場景 | 全部 |

規則：
- **店家之間不能互相引用**。兩間店都要用的東西，放到 `game/`（邏輯）或 `scene/`（3D）。
- 跨資料夾一律用 `@/` 別名（例如 `import { costOf } from '@/game/economy'`），不要寫 `../`；同一資料夾內用 `./`。
- 以上規則由 `tests/architecture.test.ts` 自動檢查，違反時 `npm test` 會失敗。
- 能寫成純函式的計算（價格、扣庫存、門檻、菜名）都放在 `game/` 或 `data/`，並補上測試，不要寫在元件裡。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器 http://localhost:5173/JapaneseGrillSimulator/ |
| `npm test` | 單元測試＋架構測試（Vitest，約 1 秒） |
| `npm run e2e` | 瀏覽器實際玩一遍四間店（需先開 dev server，約 4 分鐘）。`node tests/e2e/flow.mjs <url> grilledfish` 只測一間 |
| `npm run build` | 型別檢查＋建置 |
| `npm run lint` | oxlint |

**改完的檢查順序**：`npx tsc -b` → `npm test` → 有動到遊戲流程時跑 `npm run e2e` → commit。

## 常見改動要碰哪裡

- **加一道食材**：在 `data/menu.ts` 的店家 `items` 加一筆；成本比例加在 `game/economy.ts` 的 `COST_SHARE`；燒烤類要在 `game/taste.ts` 的 `PAIRING` 加上調味搭配（調味的最佳時機在 `TIMING`）；有特別菜名的話加在 `data/recipes.ts`（`SPECIAL` / `BREAD`）。燒烤的 3D 模型由 `blender/grilledfish.py` 產生。
- **調整價格或成本**：`game/economy.ts`（`costOf`、`COST_SHARE`、`CAPITAL`、`SHOP_COST`）和 `data/recipes.ts` 的 `suggestPrice`、`SEASON_COST`。
- **開店門檻和菜單上限**：`data/recipes.ts` 的 `MENU_MIN`、`MENU_MAX`。
- **員工編制**：`data/staff.ts` 的 `ROLES`（二廚、三廚、外場 ×2、收銀、倉儲）。倉儲自動補貨的規則在 `game/economy.ts` 的 `restockOrder`。應徵者每局隨機產生（`game/hiring.ts`），姓名、背景、個性的詞庫在 `data/people.ts`。
- **加一間店**：`data/menu.ts` 加一個 Dish，`src/shops/<新店>/` 放它的 3D，`App.tsx` 的 Scene 掛上去，`data/staff.ts`、`data/recipes.ts` 補上它的資料，並在 `tests/architecture.test.ts` 的 `ALLOWED` 加上新資料夾。

## 3D 模型

- 模型由 `blender/*.py`（Blender 5.2）產生，輸出到 `public/models/*.glb`；手機版用 `blender/make_lite.py` 產生 `*-lite.glb`。兩個版本都要更新。
- 執行：`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/grilledfish.py -- <專案路徑>`
- 客人（十五種 Q 版角色、每種有幾種髮型隨機搭配、共用一副骨架，動作 Sit／Eat／Walk；出現比例是 `data/guests.ts` 的 `weight`）由 `blender/guests.py` 產生 `public/models/guests.glb`，`scene/Person3D.tsx` 載入後依客人換膚色、髮色、衣服顏色與花紋。手機不跑 3D 吧台，所以沒有 lite 版。

## 慣例

- 手機（`PHONE_QUERY`）營業時用 2D 吧台（`ui/GuestCounter`），不跑 3D 吧台。
- 程式註解用英文，風格跟周圍一致；介面文字中日雙語（`data/i18n.ts`、`data/lines.ts`）。
