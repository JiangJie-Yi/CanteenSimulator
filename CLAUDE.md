# JapaneseGrillSimulator 日式燒烤模擬器：開發守則

React 19 + TypeScript + Vite + three.js（@react-three/fiber / drei）。推到 `main` 就會由 GitHub Actions 測試、建置，並部署到 GitHub Pages。

這是一間日式燒烤店（聞野・日式烤魚），遊戲裡只有這一間：`data/menu.ts` 的 `DISHES` 只有 `grilledfish`。火鍋、牛肉麵、麵包店已整個移除（資料、程式、模型、測試）。

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
| `npm run e2e` | 瀏覽器實際玩一遍（需先開 dev server，約 4 分鐘；預設用 `?q=low` 跑，軟體 GL 在最高畫質只有 1 FPS，`Q=high` 可改）。`node tests/e2e/flow.mjs <url> grilledfish` 只測一間；沒有 Chrome 時 `CHROME_PATH=<chromium 路徑>`；軟體 GL 很慢時 `OPEN_FOR=240000`（營業等待毫秒，預設 40000） |
| `node tests/e2e/views.mjs` | 從乾淨的瀏覽器把 9 個視角各截一張（`OUT=<資料夾>`、`Q=low`），檢查每個視角的構圖 |
| `node tests/e2e/look.mjs` | 開店後近拍吧台客人（`OUT=<資料夾>`），看人物造型用 |
| `node tests/e2e/paths.mjs [url]` | 客人動線檢查：開店後每 0.3 秒量每位走動中的客人四周（膝、胸高度），報告撞到的擺設；坐上自己的椅子不算（`WATCH=<ms>` 觀察時間） |
| `node tests/e2e/clips.mjs [url]` | 穿模檢查：量場景裡每個實心網格，不同擺設（`Movable` 的 id，群組上有 `userData.editId`）的包圍盒重疊時，取一邊的頂點檢查是否埋進另一邊超過 `TOL`（預設 1.5 公分），列出最嚴重的配對（`TOP`、`OUT=<json>`）。模型不是封閉網格（飲料櫃）、本來就插進孔裡的線（收銀台的機器）會誤報 |
| `node tests/e2e/perf.mjs [free\|grill]` | 效能量測：用這台電腦的真顯示卡（headless Chrome＋ANGLE D3D11，不是軟體 GL）量每秒畫面數、慢的那幾格、每格的繪製次數與三角面、renderer 每格花的時間；`OPEN=<毫秒>` 先開店讓客人進來、`BY=1` 每件擺設各畫幾次、`SUBS=1` 每個 useFrame 的時間、`PROF=1` CPU 剖析、`WHO=1` 誰在呼叫 renderer（多出來的整場重畫會在這裡出現）。頁面加 `?pace=0`，量的時候不會自動降畫質 |
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

- 只用 **G** 鍵進出（沒有按鈕）。面板「場景與攝影機」下方顯示整個場景的三角面數（`SceneTally.tsx`，開發者模式開著時每 1.5 秒數一次看得到的網格，含描線）。介面是 Blender 風格的深灰面板：左邊工具列，熱鍵照 Maya（選取 Q、位移 W、旋轉 E、縮放 R；同一個鍵再按一次切換世界／物件座標；4 線框看拓撲、5 回到著色），選到物件時面板顯示它的三角面、頂點、網格數；F 對準選取、A 看全部、Esc 取消選取；視角照 Maya：Alt＋左鍵旋轉、Alt＋中鍵平移、Alt＋右鍵推拉，不按 Alt 拖曳不會動到鏡頭；移動把手中間的橘色小方框可在面向鏡頭的平面上自由移動（三軸一起）；進開發者模式（G）時視角切到 1 自由視角（總覽），離開時鏡頭不動（選單收起不會改構圖）；面板下方列出熱鍵；清單分「場景」「攝影機」兩個頁籤（`edit.ts` 的 `listTab`；點選到的東西在哪一頁就自動切過去），可搜尋（只找目前那一頁），變換區的 X／Y／Z 是紅綠藍色條。位置、移動箭頭、旋轉環、縮放把手都用**房間軸**（吧台方向 `ALONG`），不是各物件父層的軸。
- 每件能動的擺設用 `<Movable id label>` 包起來（裡面放自己的 `<StaticBatch>`；Movable 不能放在別的 StaticBatch 裡面）。開發者模式每件物件有一個貼合模型的細線框（`Movable.tsx` 的 `useEditBox`：量模型的頂點，順著物件的斜度找最貼的角度）：平常淡藍、只在沒被擋住處顯示；滑鼠移上去變亮、選到變橘色，這兩種會穿透顯示。點選的是物件本身的網格，所以大物件不會擋住前面的小物件。位置框（量出的範圍）仍用來放箭頭和算中心。
- **預設值**：位置預設寫在 `edit.ts` 的 `BASES`（父層單位）；大小與轉向預設用 `<Movable baseScale baseTurn>`。定好預設後面板歸零（位置 0、縮放 1）。改了預設要把 `edit.ts` 開頭的三個 localStorage key 版本加一，不然瀏覽器裡舊的偏移會重複計算。有預設轉向或縮放的擺設（例如備長炭籃、行燈），量到中心點之前先不顯示，避免載入時閃一下。
- **編輯介面中日文**：文字在 `data/editText.ts`（`EDIT_TEXT` 中、日各一份，`pieceName` 把擺設名稱翻成日文）；App 用 `setEditLang` 跟著遊戲語言切換。新增擺設時，中文名稱只用中文，並在 `PIECES_JA`（或 `WORDS_JA`）補上日文。
- **座標軸與中心點（像 Maya）**：工具列下方「物／世」切換物件座標（軸跟著擺設自己的方向）與世界座標（整個場景的 X、Y、Z）；每次點選新的物件都先回到物件座標，面板「變換」最上方的色塊（藍＝世界、橘＝物件）隨時顯示目前是哪一種，切換時會跳提示；旋轉值一律記在世界座標裡，切換只改箭頭與位置欄位的軸；位置欄位也跟著換。按 **D**（或工具列的 D）進中心點模式：移動箭頭改成搬中心點（`edit.ts` 的 `pivots`、`setPivot`，存在 localStorage），物件本身不動（自動補償位移），之後旋轉、縮放都繞新中心點；再按 D 回到搬物件。
- **+ / −**：按 X、Y、Z 選軸（再按一次取消），+ 或 − 縮放選到的軸（沒選就三軸一起）；縮放區每軸旁也有 −、+ 按鈕。
- **群組**：清單裡 Ctrl／Shift 點選多件 → 「成組」；群組可一起位移、繞垂直軸轉、整體縮放（轉動中心是成員的中間）。「解散」「改名」「復原」都能用。沒有中心點的東西（閘門）不能成組。預設群組在 `edit.ts` 的 `DEFAULT_GROUPS`（門口招財貓台＋四隻貓 `grp-doorcats`、小神龕的供桌＋供品 `grp-altar`）；解散後記在 localStorage，不會再自動出現。場景裡點到群組成員會選到整個群組（一起移動、旋轉、縮放），按住 Alt 點才單選那一件。選到群組時，群組中心會出現自己的移動箭頭／旋轉環／縮放把手（`Movable.tsx` 的 `GroupGizmo`，房間軸），旋轉 X、Y、Z 三軸都能調（`Group.r`）。
- **座標歸零**（面板下方按鈕，像 Maya 的 Freeze Transformations）：把選到的物件或群組現在的位置、旋轉、大小當成新的 0／1，物件不動，之後面板從這裡算（`edit.ts` 的 `freezeSelected`、`zeroOf`，存在 localStorage `jgs-edit-frozen-1`；「全部還原」會一起清掉）。BDD：`tests/bdd/edit-freeze.test.ts`。
- 面板的標題列可以拖曳移動（位置存在 localStorage `jgs-edit-panel-pos`）。
- **渲染**（面板的「渲染」區塊）：逐件設定選到的擺設怎麼畫：光影（平滑／平面）、材質（原本／卡通／寫實／無光）、描線（開／關）、投影、受影（開／關）；選到群組就套用到每個成員。只存跟原本不同的設定（localStorage `jgs-edit-render-1`，「還原這件的渲染」或「全部還原」清掉）。規則是純邏輯 `game/renderPrefs.ts`（BDD `render-prefs`）；`shops/grill/renderPrefs.ts` 的 `RenderPrefsApply`（掛在 App 的場景裡）照每個網格最近的 Movable（`userData.editId`）套上去：設定一變就套，有設定時每秒再掃一次（後來才載入的東西）；換掉的材質依原材質做一次共用，原本的材質記在網格上，還原時換回去。
- 進開發者模式會自動收起選單，離開後還原；選單收放或離開開發者模式不會讓鏡頭重新歸位（只有換菜、重設視角、總覽、視窗大小改變、進開發者模式才會；進開發者模式一律切到自由視角）。

## 廚房三種模式（`game/mode.ts`）

- **三個視角**：攝影機 1＝研製（鎖定）、攝影機 2＝開發者模式（總覽、自由拖）、攝影機 3＝自由視角（閉店預設）。
- **研製＝火烤灶台視角**：閉店時鏡頭在視角 2（火烤灶台）就是研製模式（`App.tsx` 的 `research = !ai && view === 'grill'`），換到其他視角就離開；營業時沒有研製。研製時右上角（編輯鈕左邊）有一個冷藏櫃小圖示（`fridge-toggle`），點一下開關右側的食材櫃（`ui/Menu.tsx` 的 `chiller`）。食材櫃分三區：冷凍、冷藏、常溫（`data/storage.ts` 的 `storageOf`；清酒、馬鈴薯、地瓜是常溫），底部是試做數量、全部放回，與三個補貨鍵：補到平均（`averageOrder`）、各補 5（`eachOrder`）、補滿（`topUpOrder`，補到 `PAR`）；BDD `tests/bdd/fridge.test.ts`。沒有手動烤魚。**研製**：視角固定在**攝影機 1**，手動夾食物、調味、看每塊的烤魚進度（`roast-tag`）。**營業**（店開著）：廚房自己烤（AI 主廚永遠工作，雇的員工一起），沒有手動烤魚與調味、沒有進度標籤、沒有食材櫃。規則都在 `game/mode.ts`（`modeOf(shopOpen, research)`、`canCookByHand`、`showsProgress`、`showsStockFridge`、`holdsCameraOne`；BDD 情境 `tests/bdd/mode.test.ts`）。
- **Esc** 關掉目前開著的介面（由上而下：辦公室、看板、工具選單、食材櫃、視角選單；開發者模式與收銀機說明書自己處理）。
- **帳本**是「經營」（`ui/Office.tsx`）的第三個頁籤「帳簿」（現金、開業費用、採買、收銀機取款、供品、營業額、食材、燃料、人事、利潤、利潤率）；右上角沒有「帳」按鈕。
- 客人看板（掌廚、來客、在座、最近四位的心情，`guest-board`）只在手機版顯示；電腦上客人就在 3D 吧台。
- **試吃**：研製時點試吃碗裡烤好的東西，老闆會沿他的走道走到最靠近碗的地方、轉向它、說一句（`data/bossLines.ts` 的 `TASTE_LINES`），把它拿到嘴邊吃完，再跑回原本的作息（`Boss.tsx` 的 `BOSS_TASTE`；Roasting 的 `awaitBoss`、`byBoss`）。一次一份。
- 廚師只是偶爾搧火：一段時間拿著扇子搧，再放下站著（`Person3D.tsx` 的 `fanning`），每人錯開。
- 老闆擋住鏡頭看的東西時會變淡（只在他真的蓋住畫面中央附近時），用 `alphaHash` 抖動透明，不會變黑或透出身體內部。
- 灶台桌上只有試吃碗（碗公）是常駐的碗盤：沒有備用盤疊（Roasting 的 `SPARES` 空的）；盤子（`plate-n`）、小碟（`dish-n`）、飯糰的小碟（`rawdish`）都在桌面上，只有裝著東西時才出現（`WhenHeld`）；飯桶台的下層不再放碗。
- 研製時：點冷藏櫃拿的食材**直接出現在大砧板（`tray`）上**（`Piece.fresh`，不從火堆滑過去）；烤好夾起的食物**一律放進桌上的試吃碗**（`bowl-0`、`TasteBowl`、`inBowl`，排法同盤子）。
- **攝影機 1**：該道菜的 home 視角（`App.tsx` 的 home），研製時鎖在這裡；開發者模式不再能調整它（`scene/camera1.ts` 的偏移仍會讀，但沒有編輯介面）。dev 時 `window.__freeCam = true` 可以解鎖視角做截圖。
- **視角選單**（左下眼睛鈕）：`data/views.ts` 的 `VIEW_SPOTS`，依序 1 自由視角、2 火烤灶台、3 櫃檯、4 玄關、5 小神龕、6 飲品櫃、7 廁所、8 後台區、9 老闆（`follow`：老闆的第一人稱、廣角 `WIDE_FOV`，跟著他走，閉店時才有）；各區看向一個具名群組（`TillMarble`、`look-door`、`look-altar`、`look-fridge`、`look-wc-m`、`look-back`），預設鏡頭從房間剖開的那一側（總覽的方向）、往後 `back`、往上 `up` 看過去（`App.tsx` 的 `poseOf`）；`from` 可指定別的方向、`shift` 把看的點往房內移（玄關在剖開的牆邊，用這兩個避免拍到外面的空白）；老闆視角從他眼睛的高度看著火爐。打開選單時場景裡同時標出編號圈圈（`ViewMarkers`，像 Sketchfab 的註記，點一下飛過去）；選單開著時點畫面其他地方（不是拖曳轉視角）就收起。**除了 1 自由視角，其他視角都鎖定**（不能轉、平移、縮放；App 的 `spotLock`；研製的火烤灶台另由 `lockView` 鎖在攝影機 1），開發者模式不鎖。鎖定的視角都有四周模糊＋昏暗的鏡頭效果（CSS 疊層 `.grill-focus`，研製時焦點在火上，其他視角 `is-centered` 在畫面中央），自由視角、老闆視角與開發者模式沒有。開發者模式下每個視角是一台攝影機（`ViewCams`，Movable id `viewcam-<id>`），可調位置與旋轉；調過的視角就從那台攝影機的位置、朝它指的方向看（`viewCamPlaced`）。自由視角的攝影機預設就調過：物件座標 X -0.45、旋轉 Y 15° Z 5°（位置在 `edit.ts` 的 `BASES['viewcam-free']`，轉向在 App 的 `VIEWCAM_TURN`，面板「還原」回到這裡）。
- **開發者模式只做編輯**：場景裡所有互動（夾食物、添炭、調味、澆水、收銀抽屜、廁所門、飲料櫃門、神棚、飯桶蓋、盤子拖曳）都擋掉（Roasting 的 `locked`、各元件的 `getEdit().on`、App 對 `.canvas-layer` 的 click 攔截）。
- 桌上的**行燈、團扇**用 `<Movable>` 包起來；**大砧板（`cutboard`）、調味盒（`seasoning`）、水桶（`bucket`）**是由桌面的 nudge（`moved`）定位的，開發者模式用 `EditProxy`（不畫出來的同尺寸方塊）給框與箭頭，位移量會加進 nudge（食物、鍋具、水瓢跟著走）；這三件只有位移有效，旋轉與縮放沒有作用。
- **能互動的東西都要有名稱標籤**：滑鼠移上去，游標旁出現和備長炭同款的紙標籤（名字＋做法）。3D 物件用 `shops/grill/bar.ts` 的 `tipOver(名稱, 提示)` 取代 `handOver`（會發亮、變手指、設標籤）；標籤的狀態在 `scene/hoverTip.ts`，由 `ui/HoverTip.tsx` 畫（開發者模式隱藏）。不能放在 `StaticBatch` 裡（合併後沒有事件）；門這類小目標用一片透明的感應面（見 `ToiletHit`）。目前沒有標籤的：招財貓、客人、食材冷藏櫃的蓋子（沒有互動）。
- **電燈開關**（門邊牆上、手的高度，`blender/lightswitch.py` → `lightswitch.glb`，`DiningRoom.tsx` 的 `LightSwitch`，Movable `lightswitch`）：點一下關燈、再點一下開燈（規則 `game/roomLights.ts`，BDD `room-lights`；狀態 `scene/lightsStore.ts`，存 localStorage `jgs-lights-1`）。關燈時吊燈與燈串變成沒點亮的紙與燈泡、光暈與桌上的光圈消失（`nightGlow` 的 `lamp`；窗外的天光不受影響）、灶台上方的暖色聚光燈熄、店裡的環境光降到 `roomDim`（白天剩窗外的天光，晚上連代表月光的主光一起暗，只剩爐火、行燈與飲料櫃的光）；關燈時開關上的小綠燈（ホタル）亮著，黑暗中找得到。
- **牆角喇叭**（`DiningRoom.tsx` 的 `WallSpeaker`）是音樂唯一的開關：點一下開、再點一下關，預設關（`ui/bgmStore.ts`，`ui/Bgm.tsx` 負責播放，音量固定）；hover 會發亮並出現「音箱／點一下開啟（關閉）音樂」標籤，開著時飄出音符（`MusicNotes`）。沒有任何音樂的 2D 介面或按鈕。
- **客人的盤子**：`shops/grill/wareDesigns.ts` 五款花色（唐草、青海波、鯉魚、梅花藍底、風車）依盤子輪流用；竹、梅仍是 `ware.ts` 的大盤與小碟。`PlateRack.tsx` 是碗盤櫃架（Decor 裡的 `RackAt`）。
- **開發者模式左下角**有世界座標小圖（`App.tsx` 的 `AxisWidget`）：X 沿吧台、Y 向上、Z 橫過吧台，隨鏡頭轉。
- **介面風格**：木紋深色外框與標題列、半透明淺色面板（`index.css` 末尾的 `--grain-dark`、`--grain-light`）；只是按的東西（食材卡、補貨鈕）用半透明玻璃，不用木色。
- **HDRI**：`scene/IndoorHDRI.tsx` 在 `public/hdris/` 找真的 HDRI（夜晚 `grill_night_1k.exr`、`night.exr`、`night.hdr`；白天 `grill_day_1k.exr`、`day.exr`、`day.hdr`，.exr 或 .hdr 都可以），沒有就用內建的假 HDRI。**BGM**：`ui/Bgm.tsx` 播 `public/music/IzakayaNight.mp3`。

## 常見改動要碰哪裡

- **加一道食材**：在 `data/menu.ts` 的店家 `items` 加一筆；成本比例加在 `game/economy.ts` 的 `COST_SHARE`；燒烤類要在 `game/taste.ts` 的 `PAIRING` 加上調味搭配（調味的最佳時機在 `TIMING`）；有特別菜名的話加在 `data/recipes.ts`（`SPECIAL` / `BREAD`）。燒烤的 3D 模型由 `blender/grilledfish.py` 產生。
- **調整價格或成本**：`game/economy.ts`（`costOf`、`COST_SHARE`、`CAPITAL`、`SHOP_COST`）和 `data/recipes.ts` 的 `suggestPrice`、`SEASON_COST`。
- **開店門檻和菜單上限**：`data/recipes.ts` 的 `MENU_MIN`、`MENU_MAX`。
- **員工編制**：`data/staff.ts` 的 `ROLES`（二廚、三廚、外場 ×2、收銀、倉儲）。倉儲自動補貨的規則在 `game/economy.ts` 的 `restockOrder`。應徵者每局隨機產生（`game/hiring.ts`），姓名、背景、個性的詞庫在 `data/people.ts`。
- **加一間店**：`data/menu.ts` 加一個 Dish，`src/shops/<新店>/` 放它的 3D，`App.tsx` 的 Scene 掛上去，`data/staff.ts`、`data/recipes.ts` 補上它的資料，並在 `tests/architecture.test.ts` 的 `ALLOWED` 加上新資料夾。

## 3D 模型

- 模型由 `blender/*.py`（Blender 5.2）產生，輸出到 `public/models/*.glb`；手機版用 `blender/make_lite.py` 產生 `*-lite.glb`。兩個版本都要更新。
- 執行：`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/grilledfish.py -- <專案路徑>`
- 下載來的模型（魚、冰箱、招財貓）貼圖用 `blender/shrink_textures.py -- <檔案.glb>…` 縮到 1024 px 並轉 JPEG（只換圖，網格不動）；新加入的外部模型也要跑一次。
- 喇叭（`blender/speaker.py` → `speaker.glb`）與收銀機（`blender/register.py` → `register.glb`，節點 `RegBody` 固定、`RegDrawer` 由遊戲滑出；顯示幕數字、發票、抽屜裡的錢仍由程式畫）也是 Blender 產生；兩者只在 3D 吧台出現，沒有 lite 版。描邊用 `inkModel(root, skip, { width, weld: true })`（細線、平滑法線，硬邊模型不會裂開）。
- 收銀機可以操作（`shops/grill/cashRegister.tsx`）：按鍵（模型節點 `Key_<鍵名>`）與模式鎖（`RegModeKey`，OFF→REG→X→Z）照 `game/register.ts` 的純邏輯運作（BDD：`tests/bdd/register.test.ts`），印出的發票是 `drawReceipt` 畫的；客人結帳時收銀員自動按鍵並記入營業額。dev 時 `__register` 看狀態。r3f 的 `<primitive>` 上的事件不會生效，互動要包一層 `<group>`。
- 收銀櫃上的平板（`blender/ipad.py` → `ipad.glb`，`shops/grill/Ipad.tsx`；螢幕節點 `IpadScreen` 貼遊戲的點單畫面）與下層的紙箱和說明書（`blender/tillboxes.py` → `tillboxes.glb`，`TillBoxes.tsx`；點說明書 `TillManual` 打開 `ui/RegisterManual.tsx`，內容在 `data/registerManual.ts`）。
- 收銀櫃檯本體（`blender/tillcounter.py` → `tillcounter.glb`，`TillCounter.tsx`）：深色木櫃；客人側正面是鬆散不規則的綠竹（每根粗細、傾斜、彎度、竹節、色調（`TillBamboo0`～`4`，`TillCounter.tsx` 的 `BAMBOO_SHADES`）都不同，竹節是一圈細深線加淺色唇，上下兩根橫竹用黑繩綁），後面一片暖光面 `TillBambooGlow` 從竹縫透出；側面圓窗是紙燈（窗紙 `TillWindowPaper` 內退、由裡發光，窗框、內襯、格子是淺色櫸木）；白色大理石檯面（亮面）；隔板是胡桃木立格子（底下深銅色踢腳、上下橫框、立柱、壓頂，格子後面是淺色檜木板，兩個開口端是帶圓頂的圓柱；踢腳、橫框、壓頂沿一條帶圓角的路徑一體成型 `sweep`，轉角是圓柱，沒有接縫），客人側左端（服務鈴那頭）留空，招財貓那端一路延伸到收銀員側邊緣。
- 收銀櫃上的小東西（`blender/tilldesk.py` → `tilldesk.glb`，`shops/grill/TillDesk.tsx`）：筆筒 `TillPens`、明細印表機 `TillPrinter`、刷卡機 `TillCardReader`（桌上型：斜面機身、灰色液晶、導覽鍵、橡膠數字鍵、紅黃綠鍵、內建出單機，前端插著一張卡）、服務鈴 `TillBell`、胡桃木台座 `TillMat`（15 cm 高，正面兩個抽屜、黃銅把手）、找零盤（カルトン）`TillTray`、招財貓石座 `TillCatStand`，各自一個 Movable；服務鈴可以按（`TillBellLive`：按壓桿 `TillBellPlunger` 下壓、叮一聲）。放在台座上的（平板、筆筒、印表機、刷卡機）在 `edit.ts` 的 `BASES` 裡 y 墊高 0.15；它們的線各自收進身後桌墊上的小孔（模型的一部分，跟著移動），平板的線藏在支架裡，收銀機的電源線從機身背後收進機身下的走線孔。**編輯面板顯示的是房間座標，`BASES` 存的是父層座標，寫預設前要用 `fromRoom(id, v)` 換算。**
- **客人（老闆款）**：跟老闆、店員同一個風格與身高（`blender/folk.py` → `public/models/folk.glb`，`scene/FolkFigure.tsx`；GuestBar3D 的 `FOLK_GUESTS`，網址加 `?guests=old` 換回舊的 `guests.glb` 客人）。原則是**低面數＋平滑光影＋貼圖**：身體是 24 段的車削體，衣服整件畫成一張貼圖（`public/textures/folk/outfit_<種類>_<0|1>.png`，16 種客人各兩種配色：西裝領帶、水手服、立領學生服金扣、浴衣腰帶、女僕圍裙…）；臉是頭前方一片貼圖，8 種表情排成一條（`face_<male|female|elder|kid>.png`：平常、眨眼、開心、生氣、難過、咀嚼、說話、驚訝），換表情只是滑動貼圖；14 種髮型（`Folk_hair_<款>`）與配件（`Folk_acc_<名>`：眼鏡、鬍子、耳機、遮陽帽與相機、黃色小學生帽與書包、背包、女僕頭飾、暴走族頭巾、大圈耳環、浴衣蝴蝶結與花簪、披肩、毛巾、立領）依種類與 id 選（`HAIR`、`ACC`）；膚色、髮色照舊的 `lookOf`。每種髮型＋配件組合只建一次（身體、頭、兩手各依材質合併、描線），再複製給每位客人（各自的材質，才能各自淡出）。坐下時圓身體坐在高腳椅坐墊上（`SEAT`），吃飯左手端碗、右手筷子送到嘴邊；滑手機、托腮、跟同伴說話時身體轉向對方、上菜時跳一下、心情在臉上。每位約 3,000 個三角面。貼圖在開頭就預載（`useLoader.preload`），每位客人自己一個 Suspense，載入中不會讓整個場景消失。
- 舊客人（十五種 Q 版角色、每種有幾種髮型隨機搭配、共用一副骨架，動作 Sit／Eat／Walk；出現比例是 `data/guests.ts` 的 `weight`）由 `blender/guests.py` 產生 `public/models/guests.glb`，`scene/Person3D.tsx` 載入後依客人換膚色、髮色、衣服顏色與花紋。手機不跑 3D 吧台，所以沒有 lite 版。
  - 店員（二廚、三廚、外場、收銀、倉儲）不用 guests.glb：是老闆的同一個 Blender 腳本換裝（`CREW=<款式> blender … --python blender/boss.py` → `public/models/crew_<款式>.glb`：`chef` 白割烹著＋白頭巾帽＋深藍圍裙、`chefF` 女廚師（低髮髻）、`server` 靛藍作務衣（刺子格紋）＋白鉢卷＋短圍裙、`serverF` 紫紅和服（梅花紋）＋金腰帶（背後太鼓結、紅帶締）＋高髮髻與紅梳、`stock` 卡其工作服＋白鉢卷＋脖子上的毛巾＋工作手套），節點名稱與老闆相同（`BossHandL` 等）。年輕的臉：小鼻子、眼睛稍大、細短的眉、腮紅；女性有睫毛、玫瑰色的嘴、齊瀏海與鬢角。遊戲裡是 `scene/StaffFigure.tsx`：膚色、髮色、眼鏡照辦公室頭像（同一個 id 雜湊；`CrewSkin`、`CrewHair` 兩個材質由遊戲上色），每款只建一次（身體依材質合併、眼睛、眼鏡、兩手各自一組，描一次線），再複製；走路像老闆一樣搖擺，外場端托盤、倉儲拿板夾、廚師偶爾搧火（`TRAY_AT` 是托盤／板夾在手上的位置）。客人仍用 guests.glb、保留短腿（要坐吧台高腳椅）。
  - 老闆與店員的面數：`boss.py` 每顆球、每條管、每個車削體都只用約 6 成的段數（`LOD`、`uv_sphere`），老闆 18,800 → 8,600 個三角面，店員各約 8,000。
  - 頭髮：`cap()` 預設把髮殼鋪成貼著頭的網格（每一欄從頭頂到 keep() 的髮際線），髮際線是平順的線，不是沿頭部網格的鋸齒；頭巾、帽緣用 `surf_ring` 沿頭型繞一圈。身上不同顏色的交界由 `smooth_seams` 拉平，脖子處加一圈同色的滾邊。頭飾的三角面預算在檔尾 `BUDGET`（太低會被減面成碎片）。
  - 預覽單一角色的頭部特寫：`PREVIEW_KIND="chef,crop;staffF,bun" PREVIEW_YAW="25;160" blender -b --factory-startup --python blender/guests.py -- <輸出專案路徑> <圖檔.png>`（每個角色每個角度一張；輸出專案路徑可指到暫存資料夾，避免動到正式的 glb）。

- 食材櫃卡片的食材圖是 `ui/FoodArt.tsx` 手繪的 SVG（不用圖片），畫風照員工大頭貼（`ui/Avatar`）：平塗、明暗是俐落的兩階色塊、白色小反光、同一種墨線、不畫影子。**整條魚**每種有自己的身形參數（`FISH`：多深、最深處在哪、肚子多飽、尾柄多細，身體用平滑曲線 `smoothPath` 穿過這些點畫出），背到腹的光澤漸層、背腹交界一條銀線、背上鱗片、長條高光、腹下陰影、鰓蓋與鰓縫；各自的鰭（`dorsal`、`anal`、`adipose`、`finlets`、`fork`）與特徵：香魚高背鰭、脂鰭與金斑，秋刀魚的黃色下顎尖與尾前小鰭，鯖魚的硬棘背鰭、小鰭與波紋，竹筴魚的稜鱗與黃線，沙丁魚的黑點，柳葉魚的雀斑與魚卵，花魚的條紋與長背鰭，鰤魚的黃線與黃尾，紅喉的紅身大眼；**切身**是有厚度的肉塊（鮭魚的波浪油花、銀鱈的肉紋，皮與皮下深色肉）；其他食材各自一張（玉米粒、香菇十字刀、魷魚格紋…）。卡片上方的帶狀圖依各自的外框裁切。菜單直條上方也用同一張圖（`ui/Menu.tsx` 的 `StripArt`：研發出來的菜用它的主食材，套餐用它的魚；沒有圖的才用 `ui/Icon` 的線條圖示）。全部食材大圖一頁檢查：`npx vite-node tests/visual/foodsheet.tsx <輸出.html>`（同一次 render，漸層與裁切的 id 才不會重複）。`public/icons/food/*.png`（`blender/food_icons.py`）已不用。
- 料理台的木紋是 `blender/woodtex.py` 產生的貼圖（`public/textures/keyaki_top.jpg`：四片櫸木拼板、山形紋，每 1.6 單位一格；`cedar_panel.jpg`：台身的直立杉木板＋框），Roasting 的 `woodTex`、`panelBox`（依面寬給 UV，木板不會被拉長）；台身腳下一條深色踢腳。烤網架高（`grilledfish.py` 的 `NET_Z`，網上的食物跟著）。
- 食材冷凍櫃（`blender/freezer.py` → `freezer.glb`，Decor 的 `IngredientFridge`）：節點 `FreezerBody`、`FreezerLid`（鉸鏈在後緣，遊戲掀起）、`FreezerGoods`（打開要豐富：冰衣整魚、真空包魚片、保麗龍魚箱、網籃裡的秋刀魚、冰塊；底下一層庫存箱，看起來半滿）；外觀保持乾淨：不描黑線，只有格柵、溫控（顯示幕顯示櫃內溫度，下方旋鈕 `FreezerKnob`：點左半邊調冷、右半邊調暖或用滾輪，一次 1℃，-25～-15℃，預設 -20℃，設定存 localStorage `jgs-freezer-temp-1`；開蓋時櫃內慢慢回溫、關上後回到設定；邏輯在 `game/freezer.ts`，BDD `freezer`）與紅色玻璃燈泡（遊戲裡畫，會發光）；開口的鍍鉻邊框是一整圈、從機身外緣內縮，角落不凸出，不加多餘小零件；點一下開／關（`FREEZER.open`），拿食材時也會自己掀一下。
- 灶台桌前緣的缺口（`bar.ts` 的 `COOK_NOTCH`）是老闆站著烤的地方，夠一個人站進去；東西不會放在缺口上方（Roasting 的 `clearOfHearth` 也把東西推出缺口）；桌上東西互推（`settle`）時不算桌下櫃子裡的盤子。兩側的櫃子（`CUBBY`、`CUBBY2`）各一扇單開門（鉸鏈在桌子外端），缺口正面（灶台下）是中間對開的淺櫃；門是同色系、稍亮的杉木框板門，內嵌橢圓把手（`CubbyDoors`，`hinge` 'low'／'high'／'both'，往外打開；滑鼠移上去打開一下，點一下保持開著；滑鼠停在櫃子開口裡時門不會關，裡面的盤子拿得出來）。兩側的櫃子裡在頂板下有一條暖色燈條（`CubbyDoors` 的 `lit`）：門打開時亮起、照亮裡面（高畫質多一盞小燈），關門就熄，不會從門縫漏光。廚餘桶（`trash`）與竹籃（`basket-0`）在桌面左端（`data/menu.ts`），不在櫃子裡。
- 店內的菰樽（草蓆包的清酒桶，一疊三個，約 1.1 高）是 `blender/komodaru.py` → `komodaru.glb`（`DiningRoom.tsx` 的 `SakeStack`，整疊約 9,600 個三角面：桶身 32×10 段、草繩斷面 8 邊）；飯桶 `blender/ricetub.py` 的白飯是一粒粒畫出的米（畫在貼圖上；飯桶約 5,000、飯桶台約 3,700 個三角面）。
- 圓凳（`blender/stools.py`）：客人的吧台椅 `stool.glb`（矮胖的款：座面頂 29 公分、兩片橡木拼的圓座面像饅頭一樣圓邊、蓬鬆的藍色坐墊滾邊加釦子、四支粗腳外八到圓腳、一圈腳踏環；木紋照每個零件的方向：座面是攤平的平切紋、腳與環是順著長的直紋，`StoolOak`／`StoolOakLeg` 兩張貼圖）；收銀台後面兩張 `tillstool.glb`（`TillStoolHigh` 收銀員的高腳凳 43 公分兩圈環、`TillStoolLow` 幫手的矮凳 33 公分；GuestBar3D 的 `Register` 裡，Movable `till-stool-hi`、`till-stool-lo`，塞在檯面下）。客人坐的高度 `FolkFigure.tsx` 的 `SEAT`（0.31，坐在壓下去一點的坐墊上）；舊客人（`?guests=old`）坐下時往下移 `OLD_STOOL_DROP`。每張約 2,500～3,000 個三角面。
- 其他 Blender 模型：竹盆栽（`blender/barfurnish.py` → `bamboopot.glb`，`BarFurnish.tsx`）、廁所免治馬桶、洗手台與小配件（`blender/wc.py` → `toilet.glb`、`washstand.glb`、`wcbits.glb`）、大砧板（`blender/cutboard.py` → `cutboard.glb`，淡色檜木四片拼板，Roasting 的 `Tray`）、飯桶（`blender/ricetub.py` → `ricetub.glb`，節點 `RiceTubBody`／`RiceTubLid`／`RiceTubRice`，蓋子仍可點開）；飯桶台（`blender/ricestand.py` → `ricestand.glb`：檜木桌面加胡桃木邊框、雲形牙板、外撇的桌腳、竹條下層放碗）。
- 人物與食物的光影是柔和五階漸層（`Person3D.tsx`、`Dish.tsx` 的 `gradientMap`），人物另有手繪式由下往上的明暗與邊緣微光（`airbrush`），參考冷凍櫃上那條手繪藍魚的風格。

## 烤魚店的 3D 店面（`src/shops/grill/`）

| 檔案 | 內容 |
|---|---|
| `bar.ts` | 店面的共用資料與純計算（不含 React）：吧台 `GRILL_COUNTERS`（`shift` 座位位移、`far` 牆距）、座位 `seatsOf`、整間地板 `roomOf`、閘門 `BAR_GATES`/`gateOf`、收銀台 `TILL`、廁所 `toiletsOf`、飲料櫃 `fridgeOf`/`DRINKS`、玄關 `GENKAN`/`inGenkan`、盤子堆 `PLATE_STACKS`、醬油碟位置 `sauceSide`；以及兩邊溝通用的狀態 `SERVICE`（出餐口與外場）、`SEATS_TAKEN`、`PLATES_SET`、`TOILETS`、`POINTER_HINT` |
| `Roasting.tsx` | 爐火、料理台、吧台本體（`Bar`、`BarCounter`、`BarGate` 擺動門）、烤物的流程與點餐 |
| `GuestBar3D.tsx` | 客人（進出、坐下、上廁所、拿飲料、換拖鞋、淡出）、外場服務生（從閘門進出送餐）、盤子、地板、玄關、收銀台 `Register` |
| `DiningRoom.tsx` | 牆面與牆上的東西（畫、門口的神棚與供品 `Altar`、男女廁所與室內 `WcRoom`）、飲料櫃 `DrinkFridge`、場內擺設 `ShopProps`（酒樽、竹子、柳樹、酒箱） |
| `Decor.tsx` | 料理台上的擺設：炭箱、扇子、行燈、飯桶與作業台 |
| `Grill2D.tsx`、`Grill2DArt.tsx` | 手機（螢幕短邊 < 600px，平板不算）不用 3D：同樣的烤爐玩法畫成 2D（邏輯在 Grill2D，SVG 插圖在 Grill2DArt） |

- 客人的餐點送到的那一刻會開心地彈一下（蹲、拉長跳起、壓扁落下，約半秒，眼睛瞇成開心的弧線約 1 秒；`scene/Person3D.tsx` 的 `served`）；dev 時 `__guestStates` 看每位客人的狀態。
- 客人模型由 `blender/guests.py` 產生：表情（`eyesJoy`、`brows*`、`mouth*`，依評分切換，見 `scene/people.ts`）、走路動作（`Walk`／`WalkF` 女性／`WalkU` 大叔／`WalkO` 老人，速度也不同）、大學生的耳機 `student.phones`。臉型（圓、長、方、瓜子）是在 `scene/Person3D.tsx` 的 `shapeFace` 依 id 變形。
- 火爐是囲炉裏，遊戲裡沿桌長方向拉長 `HEARTH_LONG`（1.15，略長方形，置中對稱；Roasting 載入時把 `FirePit`、`Robuchi` 的 x 放大，`clearOfHearth` 也用它）；爐框朝火的內壁是燻黑、帶焦痕的另一個材質 `RobuchiBurnt`（`blender/grilledfish.py` 的 `IRORI_IN`／`IRORI_W`，改這兩個要同步 Roasting 的 `HEARTH_HALF`：直紋櫸木爐框 `Robuchi`、黃銅護角；石頭目前拿掉（`grilledfish.py` 的 `STONES = False`，改回 True 就恢復，會沿框內緊密圍一整圈）；竹籤（現在是鐵串，材質名仍叫 `BambooSkewer`，遊戲靠這個名字找串）沿一圈「方中帶圓」的環站立（`ring_at`：超橢圓，四邊是平行的一列、轉角漸漸轉向），每支沿環的法線往火斜；位置由 `settle_skewers` 一支支試出來：沿環往前挪，直到食物、竹籤都不碰到已經擺好的（網格 BVH 實測、竹籤算粗細），再把剩下的長度平均分掉。改了串的東西要跑 `blender -b blender/grilledfish.blend --python blender/clipcheck.py` 確認 0 組穿模；魚是爐端燒的樣子：頭朝下對著炭火、身體幾乎打直、背鰭一排鹽白的刺、胸鰭張開、尾巴撒滿化妝鹽、眼睛烤白、嘴巴張開；蝦是一隻大明蝦直串、頭朝下、觸鬚往火垂；爐框大小讓前排的盤、碗、砧板都在框外），遊戲裡轉到跟桌邊平行；東西不能放進爐框（Roasting 的 `clearOfHearth`，方形判斷）。火爐後方有刀具組（`blender/knives.py` → `knives.glb`），大砧板是淡色檜木拼板（`blender/cutboard.py`，Roasting 的 `Tray`）。
- 備長炭（`blender/binchotan.py` → `binchotan.glb`，`shops/grill/binchotanModel.ts` 的 `useBinchotan`）：六根炭、六種碎塊、六種灰渣（`BinAsh`，灰色顆粒、底部平的），炭用卡通（toon）材質（炭面、凹凸、龜裂發光貼圖）。炭箱、手上拿的、火裡的都用它，丟進火裡外觀不變，隨溫度亮起龜裂紋；燒到 95% 會斷成 3～5 塊往下掉，變成灰（`game/coalPile.ts` 的 `crumble`，BDD `coal-pile`）。放進火裡的炭是**立著的**，像爐端燒的炭火（`standStick`）：一圈圈圍著火（`STAND_RINGS`，由內往外填，相鄰圈錯開），每根腳踩在鹽床上、往中間靠（頂端收到腳的 6 成），像圓錐形堆的柴，火焰從中間竄出來（App 的 `Fire` 從鹽床表面起、0.75 高）；鹽床高度 `surfaceY` 依模型實測（改了鹽床要重量）。**添炭只能從炭箱拖一根炭到火上**（點火堆沒有作用；只有炭能 hover，籃子不行），一次一根（`STICK_COST`、`STICK_BOOST`，BDD `fire`），炭箱少一根（`Decor.tsx` 的 `CRATE`、`takeFromCrate`，拿完換一箱）。火力條的按鈕與 AI 主廚仍是一次一份（6～7 根，`COAL_PER_ADD`）。
- 水桶與水瓢在 `blender/grilledfish.py`（`WaterBucket`、`WaterDipper`、`DipperWater`）：杉木桶板、竹箍。指到整個水桶就是拿水瓢：先舀水（水瓢沉進桶裡再提起，杯裡有水），放開就倒水（傾倒、水流），倒在食物上是灑水、倒在炭上是澆熄。
- 神棚（`blender/kamidana.py` → `kamidana.glb`，`DiningRoom.tsx` 的 `KamidanaModel`）：三社造的檜木神棚，金屬配件（千木、鰹木的金頭、屋脊、門上的金紋、擬寶珠、台階金片）用真金屬材質並反射 `scene/studio.ts` 的攝影棚環境（金屬靠反射才看得出是金屬，店內光暗也照樣亮）；橘子盤 `KamiOranges`、經本 `KamiSutra` 也在同一個檔裡。倒酒時杯中酒面依杯子內壁的半徑長高（`cupInnerR`），不會穿出杯子。
- **廁所的門**（`blender/wcdoor.py` → `wcdoor.glb`，DiningRoom 的 `useWcDoor`）：和式腰高障子拉門，杉木框（直紋順著每根料）、下半是平切杉木板（山形紋一次鋪滿整片）、上半是細密橫繁組子貼和紙、自由端有小黃銅牌（遊戲在上面畫「使用中／空き」，`LockWindow`）與嵌入的橢圓引手；門框是深色杉木（`WcDoorFrame`）。兩扇門各複製一份（各自滑開）。
- **廁所**（`shops/grill/Restroom.tsx`，規則在 `game/restroom.ts`，BDD `restroom`）：每間有清潔度與衛生紙（`TOILETS[who].room`）；客人用一次變髒一點、用掉一捲的 1/5，髒（`DIRTY_AT`）或沒紙時會抱怨，之後吃的東西評分扣分（`WC_GRUMBLE`，Roasting 讀）；開店前店員會打掃，衛生紙不會自己補。點馬桶：不乾淨就用馬桶刷打掃（刷子從角落的筒子飛過去刷、刷完發亮），乾淨就沖水（水漩下去、水箱上的洗手龍頭流水）；點衛生紙架換新捲（捲越用越細，新捲的紙頭摺成三角）；牆上有免治遙控器（點一下溫水噴一下）、沖水鈕、音姬（流水與鳥叫，女廁有人進去會自己播）。一間一次只進一位（有人在去、在裡面、在出來時，下一位等）；有人在裡面時門關著、門上小窗顯示「使用中」，點門會敲門；沒人時「空き」。進門時馬桶蓋自動掀起，燈是感應式（有人或門開才亮）；髒了地上有污漬、馬桶裡有黃圈，很髒有蒼蠅。聲音都是 WebAudio 即時合成（`restroomSound.ts`）。
- **供花**（神棚兩側花瓶，點一下換花，存在 localStorage `jgs-shrine-flowers-1`）：三組花各有加持（`game/shrineFlowers.ts`，BDD `shrine-flowers`；模型都是 `blender/shrinevase.py`，第三個參數是變體：2 榊與小菊 → `shrinevase.glb`、0、1；每根莖都是柔和的曲線：從水裡近乎直立長出、往外傾、從花底下接到花，莖與霞草細枝的曲線解析度壓低，不會暴增面數）：榊與小菊＝平安（客人耐心較長）、白金菊（`shrinevase.py` 變體 0：輪菊、糸菊、小菊）＝金運（更常拿飲料）、紅粉花（變體 1：芍藥、紅椿、桔梗、霞草）＝良緣（情侶較常來）；兩瓶同一種加倍。神棚門聲（`shrineSound.ts`）是黏滑摩擦合成的吱呀聲＋檜木共鳴＋門扣與門片碰撞聲。
- **炭火的聲音**（`shops/grill/fireAmbience.ts`，WebAudio 即時合成）：炭的劈啪聲隨火力、烤物的滋滋聲隨火上的數量（`game/fireSound.ts`，BDD `fire-sound`）；鏡頭離火越遠越小聲；營業時另有客人的人聲（`crowdAmbience`，隨在座人數 `murmur`）；玩家第一次點擊後才開始（瀏覽器規定）。
- 太陽光（App 的 directionalLight）會投影，影子涵蓋整間店；陰影圖每 3 格重畫一次（`ShadowPacer`）；只有夠大的東西會投影（包圍球半徑 ≥ `CASTER_R` 0.3，`ShadowPacer` 每 1.5 秒把新出現的小網格設成不投影：盤子、瓶子、杯子這類小東西不進陰影圖）。
- **門簾**：入口的是米白棉布、深褐菱形家紋（中間「聞」）與一行 KIKUNO · YAKIZAKANA（`GuestBar3D.tsx` 的 `crestNorenTexture`，左右翻轉畫，從店內讀起來是正的），原木橫桿（`NorenModel` 的 `pole="wood"`，沒有吊線），寬同門口、加長 `NOREN_BIG`。沒有員工出入口：打烊後（`SHOP.leaving`）員工都從正門走（`bar.ts` 的 `staffWayOut`：第一座吧台靠收銀台的閘門 → 走道 → 正門）；廚房的人先從灶台桌尾端與飯桶之間繞出來（Roasting 的 `crewWayOut`，二廚、主廚先沿桌前走），收銀員沿收銀台後方走到閘門，外場從自己的閘門出來（側吧台的繞過轉角）。
- 場景外的背景是深灰 `#26262c`（CSS 變數 `--scene-bg`，開發者面板「背景色」可改，存 localStorage `jgs-scene-bg`，`edit.ts` 的 `setBackdrop`），白天晚上一樣，中心較亮往外變暗的放射漸層（`index.css` 的 `.canvas-layer`），畫面四周有暗角（`.canvas-layer::after`，夜晚較深）；整間店底下有一片柔和的落地陰影（GuestBar3D 的 `GROUND_SHADOW`）。吊燈、燈串的光暈與桌面光圈白天淡、夜晚亮且多一圈大光暈（DiningRoom 的 `nightGlow`，跟著 data-theme）。白天圓窗（`RoundWindow`）的窗紙是天空的淡藍、竹影偏藍，窗框外一圈冷光（`WINDOW_HALO`，中間透明，不蓋掉窗紙），還有一道藍白的光斜斜照進店裡（`SUNBEAM`，兩片交叉的漸層面）；晚上都沒有。
- 開店（載入）時的起始視角是 1 自由視角（總覽，App 的 `view` 初始值 `free`），和從選單選「自由視角」完全一樣（調過的攝影機還沒擺好前先等它，App 的 `camTry`）；e2e 會先切到 2 火烤灶台再補貨。
- 把飲料從飲料櫃拖到老闆附近（3 以內）的桌上放下，老闆會走過去拿起來喝、說一句話（`Boss.tsx` 的 `BOSS_DRINK`，台詞 `data/bossLines.ts` 的 `DRINK_LINES`；dev 時 `__bossDrink`）。
- 供清酒（點門口神棚前的酒瓶）：60 秒內來客變多、每人點得較多（`App.tsx` 的 `lightIncense`、Roasting 的 `blessed`；名稱沿用舊的點香）。
- 招牌字：`scene/signFont.ts`（Zen Antique，字體載入後貼圖會重畫；新增招牌用到的字要同步加到 index.html 的字體請求）。
- **擋住視線的吊掛物會變淡**：`scene/OccluderFade.tsx` 每幾格從鏡頭朝看的目標（`__ctl.target` 在畫面上的位置，周圍一圈）打射線，標了 `userData.fade` 的群組（門簾、紅燈籠、旗幟串、幟旗、燈串、吊燈）擋在中間就淡到 18%，移開就恢復（各自複製材質，不影響共用同一材質的東西）。新的吊掛擺設要會變淡，就在它的群組加 `userData={{ fade: true }}`。
- **收銀抽屜的錢**（`game/till.ts` 的 `openingFloat`／`deposit`／`takeOut`，BDD `till`）：付現的客人把帳單放進抽屜；抽屜開著時老闆點紙鈔格或硬幣格把整格拿走，加進現金（帳本的「收銀機取款」，`ledger.till`）。
- **飲料後場庫存**（`game/drinkStock.ts`，BDD `drink-stock`）：飲料櫃旁的酒箱是後場（`bar.ts` 的 `DRINK_BACK`，開始各兩箱）；櫃裡缺 3 格以上，倉儲店員（GuestBar3D 的 `Stocker`；**雇了倉儲、店開著才出現**，外表是那位員工，沒雇就沒人補）抱一箱走過去開門補（一趟最多 `STOCK_CARRY`），補多少扣多少，後場沒貨就補不上；點酒箱訂一箱最缺的飲料，從現金扣進價（`SHOP_PURSE`，記在帳本的採買）。
- 飲料櫃每格是前排加後面一排（`RANK_DEPTH`，每台約 80 瓶；瓶子 16 段車削；前排與後排合併成一批 `StaticBatch`，每格一個看不見的感應方塊給滑鼠指，指到的瓶子周圍亮一圈 `BOTTLE_HALO`，拿起來的那瓶單獨畫）；拿出冰箱的飲料（地上、桌上、客人面前、手上）有凝結水珠（`DrinkBottle` 的 `wet`，櫃內的沒有）。
- **碗盤櫃是盤子的來源**（`game/plates.ts`，BDD `plates`）：大容量，滿的時候 50 個（`RACK_FULL`；下層插盤架 22、第三層展示 4、頂層 4 疊各 6，第二層倒扣的碗是裝飾）；盤子照實際擺法放，不互相穿透；櫃上顯示幾個就是幾個；點一下搬一疊到出餐口（最多 12 個），出餐口空了服務生自己去拿，洗好放不下的回到櫃上。
- **自動營運的營業套路**（`game/flow.ts`，BDD `flow`）：每次開店抽一種（平日、午餐尖峰、晚餐尖峰、雨天、祭典、觀光團、熟客日），各自的來客節奏、結伴比例、點單量不同，開店時主廚會說。
- **身高**：老闆（`BOSS_SCALE`）約 1.83 高，廚師與店員（Roasting 的 `CHEF_SCALE`、GuestBar3D 的 `STAFF_SCALE`）縮到跟老闆一樣；客人仍是原尺寸（吧台、椅子照他們做）。廚房地板是比客席高一階的高台（`bar.ts` 的 `KITCHEN_DROP` 為負 = 高台，GuestBar3D 的 `KitchenDais`：閘門與末端各一階踏板；服務生走上高台時跟著升高），灶台桌面約在老闆腰部；桌下櫃子的層板 `CUBBY_SHELF_Y` 跟著地板。
- 店面沿吧台縮短了 `BAR_TRIM`（`bar.ts`）；玄關 `GENKAN.along` 往吧台拉長。
- **效能（改東西時要守的）**：
  - **不要用 transmission（透光）材質**：場景裡只要有一個，three.js 就會每一格把整個房間先畫進一張圖再畫一次（曾經一顆冷凍櫃燈泡就多了 2,500 次繪製，畫面從 60 掉到 19）。玻璃感用 clearcoat、反光點、透明度做。
  - drei 的 `<Environment>`（`IndoorHDRI`）要 `memo`：它的 children 一換就重算整個環境貼圖（6 個方向畫一次房間＋60 次模糊），開店時上層一秒重畫很多次。同理，不常變的大場景元件（`ShopProps`、`DiningWall`、`Decor`、`Bar`、`CookTable`、`BarCounter`、`BarGate`、`DiningFloor`、`RoomFloor`）都包了 `memo`；新加的、會被常重畫的父層包住的大元件也要包。
  - 用 `StaticBatch` 或 `mergeByMaterial(root, keep)`（`scene/StaticBatch.tsx`）把不會動的零件依材質合併成少數幾次繪製；`keep` 留下自己會動的部分（手、眼、嘴、蓋子、按鍵、抽屜、螢幕…）。模型的材質要依來源材質共用一份（用 Map），不然每個零件一個材質就合併不起來。合併後的網格不能被指到：要能點的東西放一個 `visible={false}` 的感應方塊（r3f 的射線不管 visible），例如飲料櫃的瓶子、炭籃的炭、碗盤櫃。`StaticBatch` 藏起來的原物件不再每格更新矩陣。
  - 目前（Intel Arc B580，1920×1080，最高畫質）：閉店總覽約 1,700 次繪製、60 fps；火烤灶台 840 次、60 fps；開店總覽約 2,200 次、約 45 fps（dev 模式）。
- 桌機（非觸控）一律最高畫質（`scene/quality.ts`），只有手機才判斷降級；卡頓時 `scene/FramePacer.tsx` 會自動降解析度，再不行就鎖 30fps（載入後 10 秒才開始判斷、看一段時間裡中位數的那一格，偶爾的頓一下不算；降到 1 倍解析度後會一直維持；網址加 `?pace=0` 就不會降）；右上角一排圓鈕（由左到右：經營（店面小圖）、自動營運（自，亮燈＝開）、×2 遊戲倍速、開店／閉店、語言、日夜；窄於 900px 時經營與自動營運仍是左上的長鈕），現金單獨顯示在左上（`money-chip`，點一下開帳簿）；×2 是遊戲倍速（`scene/speed.ts` 的 `GAME_SPEED`：3D 時鐘由 FramePacer 手動推進，App 的計時器也乘上它）。

**開發用（只在 dev）**：瀏覽器 console 可用 `__gl`（renderer，看 draw calls）、`__scene`、`__cam` 與 `__ctl`（設定視角：`__ctl.target.set(...)`、`__cam.position.set(...)`）、`__service`、`__toilets`（例如 `__toilets.m.open = true`）。場景裡名稱 `look-*` 的群組（`look-altar`、`look-fridge`、`look-door`、`look-wc-m`…）方便用 `__scene.getObjectByName` 找位置截圖。

## 慣例

- 手機（`PHONE_QUERY`）營業時用 2D 吧台（`ui/GuestCounter`），不跑 3D 吧台。
- 程式註解用英文，風格跟周圍一致；介面文字中日雙語（`data/i18n.ts`、`data/lines.ts`）。

## 節省 token 的做法

- 驗證優先用數值（`__scene`、`__ctl`、Box3 量測、DOM 查詢），必要才截圖，且只截目標區域，不截整頁。
- 大檔（`Roasting.tsx` 約 185KB、`DiningRoom.tsx`、`GuestBar3D.tsx`、`index.css`）先用搜尋定位，再讀幾十行，不要整檔展開。
- 一次改多處用腳本批次處理；`npx tsc -b` 與 `npm test` 只在提交前跑一次。
- 回報只講結果、已驗證與未驗證的部分，不重貼程式碼。
- 對話很長時（回覆開始變慢或重複），建議推送後開新 chat，靠本檔接續。
