# JapaneseGrillSimulator 日式燒烤模擬器：開發守則

React 19 + TypeScript + Vite + three.js（@react-three/fiber / drei）。推到 `main` 就會由 GitHub Actions 測試、建置，並部署到 GitHub Pages。

這是一間日式燒烤店（聞野・日式烤魚），遊戲裡只有這一間：`data/menu.ts` 的 `DISHES` 只有 `grilledfish`。火鍋、牛肉麵、麵包店已整個移除（資料、程式、模型、測試）。

## 每個 session 開始前：工作守則（店主定的，2026-11-10）

1. **動手前先讀 `HANDOFF.md`**：專案目標、已完成的項目、與規格不同的地方、待處理的問題、怎麼啟動與測試。
2. **每次只改被要求的檔案**，不要順手重構或改名。
3. **重大修改先列出計畫與會動到的檔案**，等店主同意再動手。
4. **完成後說明改了哪些檔案，以及如何驗證**（跑了哪些指令、量到的數字、截圖）。
5. **不確定時先問**，不要自行擴大範圍。

沿用的協作規則：
- 回覆與報告一律用繁體中文。
- 先定位、再改：畫面的問題先找出畫它的網格與「檔案：行號」，回報後才改；改完自己驗證，回報前後的數字或同一鏡頭的近拍對照。
- 提交訊息用 `feat:`、`fix:`、`perf:`、`docs:`、`refactor:`、`test:`、`revert:` 開頭；`git add` 一律列出檔案，不要 `git add -A`（根目錄有很多不進 git 的截圖）。
- 改 `src/` 的檔案用編輯工具或 Python，不要用 `sed -i`（Vite 偵測不到，瀏覽器看到的還是舊的）。
- 在自己的 worktree 分支上工作的視窗（例如 `HANDOFF.md` 5-2 的組 A、組 B）不改本檔、不推 `main`，進度只寫在 `HANDOFF.md` 自己那一節。
- 每件擺設、每個流程的細節（怎麼做的、店主為什麼要這樣、改過什麼）在 `docs/DETAILS.md`，不會自動載入：要改某樣東西前，先用搜尋找它的名字或檔名，只讀那一段。新的細節寫進那裡，不要寫進本檔（本檔只放守則與索引）。

## 固定規則（店主定的，之後不可更動；要改先問店主）

與 `HANDOFF.md` 第 4 節是同一份；行號以 2026-11-10 的 `0689e3f` 為準。

**存檔**
1. **瀏覽器存的飲料庫存不能被清掉。** 存在 localStorage `jgs-drinks-1`（`src/shops/grill/bar.ts` 第 399 行 `DRINKS_KEY`）。讀取的 `readDrinks`（`src/game/drinkStock.ts` 第 78 行）只要櫃數、層數、每層格數跟 `FRIDGE_UNITS`（`bar.ts` 第 373 行）對不上，或有不認得的飲料 id，就整個當新店、櫃子清空。所以：不改這個 key 的名字；不把它加進載入時清除的清單（`src/App.tsx` 第 150 行）；改 `FRIDGE_UNITS` 的格數或飲料以前，先寫好把舊存檔對到新位置的轉換。只有玩家按「重新開始」才清（`App.tsx` 第 2980 行）。

**燈光與開關**
2. **玄關有兩個開關，各管一條線路**：`lightswitch-room` 是店內電燈（線路 `room`），`lightswitch-door` 是門口兩盞長提灯與魚燈（線路 `door`），在 `src/shops/grill/DiningRoom.tsx` 第 4313–4314 行；線路定義在 `src/game/roomLights.ts` 第 10 行（`room`、`door`、`wcM`、`wcF`）；男、女廁另有一個雙聯開關（`DiningRoom.tsx` 第 4321 行）。
3. **營業中只關店內電燈時，門口燈籠會繼續亮**：兩條線路各自獨立（`lightOn`，`roomLights.ts` 第 15 行）；門口燈籠只在開店時自動點亮、開始收店（最後點餐）時自動熄滅（`lanternsLit`，同檔第 28 行；`App.tsx` 第 1314 行），中間照樣能用開關手動切。
4. 逃生出口燈哪個開關都關不掉（`exitSignLit`，`roomLights.ts` 第 31 行）。

**渲染**
5. 不用 `transmission` 材質：場景裡只要有一個，three.js 每一格就要把整間店多畫一次（曾經一顆冷凍櫃燈泡多 2,500 次繪製、60 → 19 FPS）。
6. 不用 `visible` 開關燈，執行中不增減燈：可見的燈數一變，所有材質都要重新編譯。
7. 營業中才出現、或執行中才換材質設定的東西，要從載入就在場景裡，或用 `warmLater` 登記樣板（營業中不能編新的著色程式）。

**店主定案的外觀（不要再改回去或重做）**
8. 滑鼠指到的發亮維持「材質複本加暖色自發光」（`src/scene/hoverGlow.ts`）；輪廓光暈那版（`156e512`）店主不要，已還原（`698b4be`）。
9. 左上角招牌維持原樣，不改成 SVG 魚形櫸木板（`7150cd1` 那版已還原）。
10. 圓窗外的景色維持多層圖那一版，只在上面小改，不整個重做。

**做事的方式**
11. 拿掉任何擺設以前先問；只有店主明說「拿掉」才拿。
12. Low-Poly 鐵律（見下面「3D 模型」）：單一小物件 50～100 面、外圈不超過 24 段；不從中心放射收聚；擺放先量邊界，不准穿模、不准兩個面在同一平面。
13. 介面：字不斷行、不用表情符號與特殊符號（用 `src/ui/glyphs.ts` 自己畫的圖示）、每個面板開關都有聲音（`usePanelSound`）、CSS 改原本那條規則，不在後面疊一條覆蓋。
14. 推 `main` 會部署網站（版本 +0.01）：先 `git fetch`、`npm test` 通過、不強推。`r1.jpg`～`r8.jpg`、`tests/e2e/_*.mjs`、`public/textures/ReferenceTexture/`、根目錄的截圖 `*.png` 不進 git。

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
| `src/shops/grill/` | 烤魚店的 3D 與互動（Roasting、吧台、客人、收銀櫃…） | data、game、scene、ui |
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
| `npm run dev:sync` | 開發伺服器＋自動同步（見「同步流程」） |
| `npm run sync` | 只做自動同步 |
| `npm test` | 單元測試＋架構測試（Vitest，約 1 秒） |
| `npm run e2e` | 瀏覽器實際玩一遍（需先開 dev server，約 5 分鐘；預設用 `?q=low` 跑，軟體 GL 在最高畫質只有 1 FPS，`Q=high` 可改）。`node tests/e2e/flow.mjs <url> grilledfish` 只測一間；沒有 Chrome 時 `CHROME_PATH=<chromium 路徑>`；軟體 GL 很慢時 `OPEN_FOR=240000`（營業等待毫秒，預設 90000：軟體 GL 約每秒 10 格，客人的時鐘跟著格數走，第一張單約一分鐘才進來） |
| `node tests/e2e/views.mjs` | 從乾淨的瀏覽器把 9 個視角各截一張（`OUT=<資料夾>`、`Q=low`），檢查每個視角的構圖 |
| `node tests/e2e/look.mjs` | 開店後近拍吧台客人（`OUT=<資料夾>`），看人物造型用 |
| `node tests/e2e/paths.mjs [url]` | 客人動線檢查：開店後每 0.3 秒量每位走動中的客人四周（膝、胸高度），報告撞到的擺設；坐上自己的椅子不算（`WATCH=<ms>` 觀察時間） |
| `node tests/e2e/dayaudit.mjs` | 一整天巡檢（約 7 分鐘）：×2 從開店跑到員工下班，每格量每個人物有沒有一格跳太遠或上下一個台階（瞬移），記下跳出的提示與營業日誌（`AT`、`END`、`SHOT`、`JSON`）；開頭共用 `tests/e2e/shop.mjs`（`boot`、`openShop`、`rush`）。整套測試流程與探針清單在 `docs/DETAILS.md`「測試流程」 |
| `node tests/e2e/crowd.mjs` | 客人走路的跳動與互相穿過：開店搶客 ×2，每格量比走路快的格數、一格跳超過 0.2 的、兩人疊在一起的（誰跟誰）、同一階段時間倒退（`WATCH`、`CALM=1`、`LIST=1`） |
| `node tests/e2e/clips.mjs [url]` | 穿模檢查：量場景裡每個實心網格，不同擺設（`Movable` 的 id，群組上有 `userData.editId`）的包圍盒重疊時，取一邊的頂點檢查是否埋進另一邊超過 `TOL`（預設 1.5 公分），列出最嚴重的配對（`TOP`、`OUT=<json>`）。模型不是封閉網格（飲料櫃）、本來就插進孔裡的線（收銀台的機器）會誤報 |
| `node tests/e2e/perf.mjs [free\|grill]` | 效能量測：用這台電腦的真顯示卡（headless Chrome＋ANGLE D3D11，不是軟體 GL）量每秒畫面數、慢的那幾格、每格的繪製次數與三角面、renderer 每格花的時間；`OPEN=<毫秒>` 先開店讓客人進來、`BY=1` 每件擺設各畫幾次、`SUBS=1` 每個 useFrame 的時間、`PROF=1` CPU 剖析、`WHO=1` 誰在呼叫 renderer（多出來的整場重畫會在這裡出現）。頁面加 `?pace=0`，量的時候不會自動降畫質 |
| `node tests/e2e/alloc.mjs` | 開店時誰在製造垃圾（記憶體配置取樣）：開店、全員到齊、×2，跑 `WARM`（預設 60 秒）後取樣 `SPAN`（預設 30 秒），列出每秒配置幾 MB 與配置最多的函式（含呼叫者）。`BASE=http://localhost:4173`（`npx vite preview`）量正式版：dev 模式光 JSX 就多好幾倍 |
| `node tests/e2e/soak.mjs` | 長時間營業會不會越來越卡：開店後每 `SAMPLE`（預設 60 秒）記一行 JSON：回收後的 JS heap、array buffer、FPS、最差的一格、繪製次數、三角面、GPU 的幾何／貼圖／程式數（`MINUTES` 預設 20）；每個數字都應該持平。`BASE=` 同上量正式版 |
| `node tests/e2e/redraws.mjs` | 開店時誰在重畫、為什麼：開店、全員到齊、×2，`WARM`（預設 45 秒）後量 `SPAN`（預設 30 秒）的每一次 React 提交，列出每個元件每秒重畫幾次，以及原因：哪幾個 props 變了（「a new object, same values」＝父層重畫時順便被帶著，自己什麼都沒變，該 memo），或自己的哪個 state 變了（以宣告它的那一行標出）。用 dev server（名稱才看得到） |
| `__triTop(n, 'piece'\|'mesh')`（dev console） | 三角面排行：照擺設（最近的 Movable id，沒有就最近的具名群組）列出畫出來的三角面最多的前 n 名（模型與描線分開、網格數、實例數）與全場總數、繪製數（不含陰影；`scene/triProfiler.ts`） |
| `npm run bench` | 性能測試（`tests/e2e/bench.mjs`，需先開 dev server；真顯示卡、1920×1080）：總覽穩定後的繪製次數、三角面、幾何、貼圖、著色程式、回收後的 JS heap；接著依序切 1～9、0 號視角（每個停 `HOLD`，預設 1 秒）、關燈再開燈、進出開發者模式，記錄平均 FPS、1% Low、最差一格（另算不含開發者模式的）、巡航前後 heap 差，與最慢的幾格發生在哪一步；寫成 Markdown 表格（`OUT`，預設 `bench.md`）與同名 .json，`BEFORE=<舊的 .json>` 並排比較 |
| `npm run build` | 型別檢查＋建置 |
| `npm run lint` | oxlint |

## 行為驅動開發（BDD）

新功能或改行為時，先用 Given / When / Then 把「使用者會看到的行為」寫成情境，再實作。工具是 `tests/bdd/bdd.ts`（Vitest 上的小包裝，不加套件）：`feature` 一個功能、`scenario` 一個情境，步驟 `given` / `when` / `then` / `and` / `but` 依序執行並共用一個 `w`；失敗時訊息會標出是哪一步（例如 `[Then 沒有任何一根的高度超過 3 層]`）。範例都在 `tests/bdd/`：`coal-pile`（炭床）、`stock`（庫存與出餐）、`restock`（倉儲補貨）、`pricing`（成本與定價）、`staff`（員工與徵人）、`taste`（調味與評分）、`research`（研發與試做）。

- 情境用中文描述行為（「炭堆不會疊得超過物理上限」），不要寫實作細節。
- 只測 `data/`、`game/` 的純邏輯；3D 與 DOM 的行為用 `npm run e2e` 或 `__scene` 數值驗證。
- 檔名放 `tests/bdd/<功能>.test.ts`，`npm test` 會一起跑。
- 使用者提出新的行為要求（如「炭不能浮空」）時，先補一個情境，再改程式讓它通過。

**改完的檢查順序**：`npx tsc -b` → `npm test` → 有動到遊戲流程時跑 `npm run e2e` → commit。

## 同步流程（本機優先）

- **每天半夜自動推送**（店主要的，2026-11-06）：Windows 排程工作「JapaneseGrillSimulator nightly push」每天 00:05 跑 `scripts/nightly-push.mjs`（錯過時間的話電腦開著時補跑）：本機 `main` 有 GitHub 還沒有的提交，先跑 `npm test`，通過才 `git push origin main`（網站部署、版本 +0.01）；沒有新提交、GitHub 上有本機沒有的提交、或測試失敗就不推；不會自己提交沒提交的修改；每次記一行在 `logs/nightly-push.log`；`DRY=1 node scripts/nightly-push.mjs` 只試不推。

本機（`C:\Users\augus\Projects\JapaneseGrillSimulator`）是主；`main` 只從本機推，推上去就部署。雲端 chat（claude.ai 網頁上的 session）的修改**只推到 `cloud-work` 分支**，不碰 `main`。

- 雲端每次動手前：`git fetch origin`，把 `origin/main` 合進 `cloud-work`（本機推的東西先拿到），改完只 `git push origin cloud-work`。
- 本機收雲端的修改：`npm run dev:sync`（或只要同步：`npm run sync`）。每 20 秒看一次，有新東西且沒有未提交的修改時：
  1. GitHub 的 `main` 有別台機器的新提交 → 快轉拉下來。
  2. `cloud-work` 有新提交 → 合併進本機 `main` → 跑 `npx tsc -b && npm test`；合併衝突或檢查失敗就退回原狀並提示。**預設不推 `main`**（推 `main` 就會部署網站）；要自動推：`SYNC_PUSH=1 npm run dev:sync`。
  3. （只在 `SYNC_PUSH=1`）本機自己還沒推的提交 → 檢查通過才推。
- 網站只在推 `main` 時部署，推 `cloud-work` 不會；所以雲端 chat 每做完一次就推 `cloud-work`，使用者的 localhost 看得到，網站不動。
- 本機的 Claude Code 在這個專案開始工作時，若 `git fetch origin` 後 `origin/cloud-work` 有 `main` 沒有的提交，且工作目錄乾淨：合併它、跑 `npx tsc -b && npm test`、通過後**不要推 `main`**，除非使用者說；有衝突或失敗就停下來告訴使用者。
- 遊戲裡的開發者模式（按 G，閉店時才能用）調的位置存在瀏覽器裡；確定後把面板上的 offset 數值告訴雲端 chat，由它寫成預設值。

## 開發者模式（`src/shops/grill/edit.ts`、`Movable.tsx`）

完整說明（操作、熱鍵、選取、群組與分區、軸心、渲染設定、角色預覽、面板）在 `docs/DETAILS.md` 同名的一節。新增或調整擺設時要守的：
- 只用 **G** 鍵進出（閉店、營業中都可以；營業中進入時遊戲暫停）。
- 每件能動的擺設用 `<Movable id label>` 包起來（裡面放自己的 `<StaticBatch>`；Movable 不能放在別的 StaticBatch 裡面）。
- 預設位置寫在 `edit.ts` 的 `BASES`（父層單位；編輯面板顯示的是房間座標，寫預設前用 `fromRoom(id, v)` 換算）；大小與轉向用 `<Movable baseScale baseTurn>`；站在地上的加 `ground`。改了預設要把 `edit.ts` 開頭三個 localStorage key 的版本加一。
- 吊掛或貼牆的擺設加進 `edit.ts` 的 `HANGS`（操作軸在中心；其他的在腳底中心）。
- 新擺設的名稱只寫中文，日文補在 `data/editText.ts` 的 `PIECES_JA`（或 `WORDS_JA`）、英文補在 `PIECES_EN`。

## 廚房三種模式（`game/mode.ts`）

完整說明在 `docs/DETAILS.md` 同名的一節（研製、營業、營業時間與深夜、員工上下班、內場分工、取料、電燈開關、晝夜、視角、日誌、結算…）。重點：
- 三種模式由 `game/mode.ts` 決定（`modeOf`，BDD `mode`）：閉店時鏡頭在火烤灶台就是研製（手動夾、穿串、調味、看進度）；營業時廚房自己烤，沒有手動烤魚。
- 營業時間 16:30–04:30（`game/hours.ts`，BDD `hours`）；過了午夜是深夜模式。
- 營業時的分工（`game/kitchenCrew.ts`，BDD `kitchen-crew`）：老闆是大廚，掌爐、上火、取下；二廚取料、穿串；三廚擺盤、顧火、煮飯、洗串；外場上菜、收盤、洗碗；收銀結帳；倉儲補貨。

## 常見改動要碰哪裡

- **加一道食材**：在 `data/menu.ts` 的店家 `items` 加一筆；成本比例加在 `game/economy.ts` 的 `COST_SHARE`；燒烤類要在 `game/taste.ts` 的 `PAIRING` 加上調味搭配（調味的最佳時機在 `TIMING`）；有特別菜名的話加在 `data/recipes.ts`（`SPECIAL` / `BREAD`）。燒烤的 3D 模型由 `blender/grilledfish.py` 產生。
- **調整價格或成本**：`game/economy.ts`（`costOf`、`COST_SHARE`、`CAPITAL`、`SHOP_COST`）和 `data/recipes.ts` 的 `suggestPrice`、`SEASON_COST`。開店後手上是 NT$200,000（店主定的：資本 `CAPITAL` 30 萬 − 開業費用 `SHOP_COST` 10 萬；BDD `pricing`）。
- **開店門檻和菜單上限**：`data/recipes.ts` 的 `MENU_MIN`、`MENU_MAX`。
- **加一間店**：`data/menu.ts` 加一個 Dish，`src/shops/<新店>/` 放它的 3D，`App.tsx` 的 Scene 掛上去，`data/staff.ts`、`data/recipes.ts` 補上它的資料，並在 `tests/architecture.test.ts` 的 `ALLOWED` 加上新資料夾。
（根莖蔬菜與大蔥、應徵者、排班制、員工編制的細節在 `docs/DETAILS.md` 同名的一節。）

## 3D 模型

**Low-Poly 鐵律**（店主定的，2026-11-02；所有 Blender 腳本建模與 3D 物件生成都要照做）：
1. **單一小物件 50～100 面，外圈分段不超過 24 段**（圓的東西 16～24 段；造型複雜、要保住輪廓的才多一點，例：收銀台的元寶 13 個剖面點、620 個三角形，8 點時像紙船；細節交給法線貼圖：小判 48 面＋畫的高度圖轉法線）。
2. **禁止中心放射狀收聚**（一圈三角形擠在中心一點，光影會出黑斑）：封口用一格一格的梯狀四邊形（`blender/common.py` 的 `ladder_fill`；`export_dish` 匯出前會把凸的多邊形封口自動轉成梯狀），車削體碰到中心軸時封旁邊那一圈，不收成一點。
3. **擺放先算邊界，不准穿模、不准 Z-fighting**：量 Box3（或 Blender 的 bound_box）留間距，不用盲目的固定座標；兩個面不能在同一個平面上（貼花、字、牆身、門框），抬高幾公釐或用 `polygonOffset`；貼在表面的小零件不投影。做完跑 `node tests/e2e/clips.mjs`、`node scripts/mesh-audit.mjs`。

- **模型掃描**（店主要的：小擺設要乾淨的低面數網格，不要從中心放射的三角形）：`node scripts/mesh-audit.mjs [檔案…]` 列出每個模型裡尺寸小於 `SMALL`（0.25）、三角面超過 `TRIS`（100）或有 `POLE`（12）個以上三角形擠在同一個頂點（中心放射，光影容易出黑斑）的網格，最嚴重的排前面（`ALL=1` 列出全部）。
- **減面（不影響畫面）**：`blender/optimize_glb.py -- <輸入.glb> <輸出.glb> '{"名稱正規式": 保留比例}'`：先合併同平面的面（看不出差別），再把超過 1500 面的零件減到比例（最少留 600 面），保留 UV 與材質邊界；貼圖以品質 95 重存。**每個減過的模型都要近拍前後對照**，看得出差別就不用。目前用過：`kamidana.glb`（6.7 萬 → 3.9 萬；規則 `{"Ebisu": null, ".*": 0.35}`：**惠比壽不減**（`null` 就是跳過；它是高模烘焙到低模的法線、顏色貼圖，減面會弄亂 UV，描線外殼從斷開的法線裡透出來，變成一片黑色碎片，店主看到了））、`freezer.glb`（1.45 萬 → 5.7 千）、`speaker.glb`（2.07 萬 → 1.41 萬），規則都是 `{".*": 0.35}`；**重新跑這三個的產生腳本後要再跑一次減面**。試過但退回的：菰樽（繩子變扁、桶身出現接縫）、武士頭盔（筋紋變淡）、招財樹與元寶（用這支工具看不出省多少；後來改在 `blender/tilldesk.py` 從源頭減：細線的圓周段數與曲線解析度依粗細與長度、葉片 4 段、石子 8 邊、元寶 44 段，招財樹 3.5 萬 → 1.8 萬、元寶 2.3 萬 → 1.1 萬，看起來一樣；2026-11-03 再降：招財樹的三根樹幹 6 邊、每段 2 步（每根 1,024 → 約 380），樹幹底部的球改 icosphere，元寶的坐墊細分 3 → 2 層（768 → 192），坐墊的金繩 41 → 21 點；近拍前後一樣）。
- **模型的方向（店主說的）**：招財貓與惠比壽的佈線是對的方向：**乾淨的低面數網格（四邊形為主），細節烘成貼圖**（顏色、法線），而不是很多面，也不是減面工具減出來的碎三角形。要減面時先想能不能這樣做（例：地瓜與馬鈴薯的 `bake_tubers`）。**每次減面或烘焙都要做品質檢查**：在遊戲裡同一個鏡頭近拍前後對照（可以用 Playwright 的 `page.route` 把舊的 glb 換回來拍：`git show HEAD:public/models/x.glb > 暫存檔`），看得出變差就再改，不要交出去。
- 模型由 `blender/*.py`（Blender 5.2）產生，輸出到 `public/models/*.glb`；只有一個版本（以前給手機與低畫質的 `*-lite.glb` 與 `blender/make_lite.py` 拿掉了，店主要的：網頁只載入完整的 3D）。
- 執行：`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/grilledfish.py -- <專案路徑>`
- 下載來的模型（魚、冰箱、招財貓）貼圖用 `blender/shrink_textures.py -- <檔案.glb>…` 縮到 1024 px 並轉 JPEG（只換圖，網格不動）；新加入的外部模型也要跑一次。
- 字不做成網格，畫進貼圖（`blender/common.py` 的 `DecalAtlas`）。
- 各模型怎麼做的、減過幾面、烘焙與前後對照的紀錄在 `docs/DETAILS.md` 的「3D 模型」一節。

## 烤魚店的 3D 店面（`src/shops/grill/`）

| 檔案 | 內容 |
|---|---|
| `bar.ts` | 店面的共用資料與純計算（不含 React）：吧台 `GRILL_COUNTERS`（`shift` 座位位移、`far` 牆距）、座位 `seatsOf`、整間地板 `roomOf`、閘門 `BAR_GATES`/`gateOf`、收銀台 `TILL`、廁所 `toiletsOf`、飲料櫃 `fridgeOf`/`DRINKS`、玄關 `GENKAN`/`inGenkan`、盤子堆 `PLATE_STACKS`、醬油碟位置 `sauceSide`；以及兩邊溝通用的狀態 `SERVICE`（裝好的菜與外場）、`PLATING`（主廚裝盤處的盤子與位置，`platingOf`）、`PLATES_OUT`、`PLATER_OUT`、`DRYER`、`SINK_BIN`、`SEAT_STICKS`、`SEATS_TAKEN`、`PLATES_SET`、`TOILETS`、`POINTER_HINT` |
| `Roasting.tsx` | 爐火、料理台、吧台本體（`Bar`、`BarCounter`、`BarGate` 擺動門）、烤物的流程與點餐 |
| `GuestBar3D.tsx` | 客人（進出、坐下、上廁所、拿飲料、換拖鞋、淡出）、外場服務生（從閘門進出，走進廚房到主廚旁端裝好的菜、收盤、洗碗、烘碗、搬回碗盤櫃）、廚房補盤的人（碗盤櫃 → 出餐口）、盤子、地板、玄關、收銀台 `Register` |
| `DiningRoom.tsx` | 牆面與牆上的東西（畫、門口的神棚與供品 `Altar`、男女廁所與室內 `WcRoom`）、飲料櫃 `DrinkFridge`、場內擺設 `ShopProps`（酒樽、竹子、柳樹、酒箱） |
| `Decor.tsx` | 料理台上的擺設：炭箱、扇子、行燈、飯桶與作業台 |
| `Grill2D.tsx`、`Grill2DArt.tsx` | 手機不用 3D（`game/device.ts` 的 `showsFlat`，BDD `device`：寬不到 600px、或高不到 500px（橫拿）、或瀏覽器說自己是手機（`phoneDevice`：userAgentData.mobile，沒有就看 iPhone、iPod、Android 手機……）；平板與電腦是網頁，一律完整的 3D，店主要的）：同樣的烤爐玩法畫成 2D（邏輯在 Grill2D，SVG 插圖在 Grill2DArt）。**目前不開放**（店主要的：手機尺寸時顯示「手機版（2D）暫不開放」，`ui/PhoneClosed.tsx`，直接放進 `body`、蓋住一切（放在舞台裡會被右上角的按鈕蓋過）；App 的 `PHONE_2D_OPEN` 改成 true 就恢復 2D） |

每件擺設與每個流程的細節（客人、外場、灶台、廁所、飲料櫃、收銀、炊飯、鐵串、碗盤、評價、水電、時鐘…）在 `docs/DETAILS.md` 的「烤魚店的 3D 店面」一節，用搜尋找，只讀那一段。

### 效能守則（摘要；每一條的來龍去脈與量法在 `docs/DETAILS.md` 的「效能（改東西時要守的）」）

- 著色程式要少：新材質用標準的 toon／standard／basic，不要為小差別各寫一個 shader（`scene/materialNormalize.ts` 讓同一種材質共用程式）。
- 營業中不編新的著色程式：營業中才出現、或執行中才換材質設定的東西，載入時就要在場景裡，或用 `warmLater` 登記樣板（`scene/Prewarm.tsx`）。
- 不用 transmission；不用 `visible` 開關燈、執行中不增減燈（燈掛在 `scene/AnchoredLight.tsx`）。
- 執行中新建的幾何體、材質、貼圖一定要釋放或共用（模組層級共用，或在 effect 的清理裡 `dispose()`；人物複本用 `releaseFigure`）。
- 不會動的零件依材質合併（`StaticBatch`、`mergeByMaterial`、素色零件 `plainColours`、偶爾才動的 `homeCopy`）；合併後沒有滑鼠事件，要能點的放一個看不見的感應方塊。
- 不要對整個場景打射線；蒙皮人物算射線很貴。
- 常被重畫的父層底下，重的子元件要 `memo`，props 要穩定（`scene/sameProps.ts`）；狀態沒變就回傳原物件。每格跑的迴圈不要 new 東西。
- 畫布濾鏡整層套一次，不要在很多筆之前設。
- 模組層的監聽器、計時器用 `scene/hot.ts` 的 `replaces`，熱更新才不會疊一份。
- 量法：`npm run bench`、`tests/e2e/perf.mjs`、`soak.mjs`、`redraws.mjs`、`alloc.mjs`（見上面「指令」）。

**開發用（只在 dev）**：瀏覽器 console 可用 `__gl`（renderer，看 draw calls）、`__scene`、`__cam` 與 `__ctl`（設定視角：`__ctl.target.set(...)`、`__cam.position.set(...)`）、`__service`、`__toilets`（例如 `__toilets.m.open = true`）。場景裡名稱 `look-*` 的群組（`look-altar`、`look-fridge`、`look-door`、`look-wc-m`…）方便用 `__scene.getObjectByName` 找位置截圖。

## 慣例

- **網頁只用完整的 3D，手機用 2D**（店主要的；`game/device.ts`，BDD `device`）：手機（尺寸或裝置，App 的 `usePhone`）整個是 2D：灶台畫成 2D（`Grill2D`，目前顯示暫不開放）、客人在 2D 吧台（`ui/GuestCounter`），不跑任何 3D；電腦與平板是完整的 3D（3D 吧台與客人；以前觸控的平板也用 2D 吧台）。**手機一開頁就不下載任何 3D 模型**（`scene/flatGate.ts`，`main.tsx` 最先 import：一開頁就是手機時，`useGLTF.preload`、`useLoader.preload` 什麼都不做；以前手機沒有 3D 畫面卻在背景下載了 54 個模型）。檢查：`tests/e2e/_device.mjs`（在 git 外：電腦、手機尺寸、手機裝置、平板各開一次，印出有沒有 3D 畫面、下載了哪些模型）。
- 程式註解用英文，風格跟周圍一致；介面文字中日雙語（`data/i18n.ts`、`data/lines.ts`）。

## 節省 token 的做法

- 驗證優先用數值（`__scene`、`__ctl`、Box3 量測、DOM 查詢），必要才截圖，且只截目標區域，不截整頁。
- 大檔（`Roasting.tsx` 約 185KB、`DiningRoom.tsx`、`GuestBar3D.tsx`、`index.css`）先用搜尋定位，再讀幾十行，不要整檔展開。
- 一次改多處用腳本批次處理；`npx tsc -b` 與 `npm test` 只在提交前跑一次。
- 回報只講結果、已驗證與未驗證的部分，不重貼程式碼。
- 對話很長時（回覆開始變慢或重複），建議推送後開新 chat，靠本檔接續。
