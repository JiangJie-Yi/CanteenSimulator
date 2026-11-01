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
| `npm run e2e` | 瀏覽器實際玩一遍（需先開 dev server，約 5 分鐘；預設用 `?q=low` 跑，軟體 GL 在最高畫質只有 1 FPS，`Q=high` 可改）。`node tests/e2e/flow.mjs <url> grilledfish` 只測一間；沒有 Chrome 時 `CHROME_PATH=<chromium 路徑>`；軟體 GL 很慢時 `OPEN_FOR=240000`（營業等待毫秒，預設 90000：軟體 GL 約每秒 10 格，客人的時鐘跟著格數走，第一張單約一分鐘才進來） |
| `node tests/e2e/views.mjs` | 從乾淨的瀏覽器把 9 個視角各截一張（`OUT=<資料夾>`、`Q=low`），檢查每個視角的構圖 |
| `node tests/e2e/look.mjs` | 開店後近拍吧台客人（`OUT=<資料夾>`），看人物造型用 |
| `node tests/e2e/paths.mjs [url]` | 客人動線檢查：開店後每 0.3 秒量每位走動中的客人四周（膝、胸高度），報告撞到的擺設；坐上自己的椅子不算（`WATCH=<ms>` 觀察時間） |
| `node tests/e2e/clips.mjs [url]` | 穿模檢查：量場景裡每個實心網格，不同擺設（`Movable` 的 id，群組上有 `userData.editId`）的包圍盒重疊時，取一邊的頂點檢查是否埋進另一邊超過 `TOL`（預設 1.5 公分），列出最嚴重的配對（`TOP`、`OUT=<json>`）。模型不是封閉網格（飲料櫃）、本來就插進孔裡的線（收銀台的機器）會誤報 |
| `node tests/e2e/perf.mjs [free\|grill]` | 效能量測：用這台電腦的真顯示卡（headless Chrome＋ANGLE D3D11，不是軟體 GL）量每秒畫面數、慢的那幾格、每格的繪製次數與三角面、renderer 每格花的時間；`OPEN=<毫秒>` 先開店讓客人進來、`BY=1` 每件擺設各畫幾次、`SUBS=1` 每個 useFrame 的時間、`PROF=1` CPU 剖析、`WHO=1` 誰在呼叫 renderer（多出來的整場重畫會在這裡出現）。頁面加 `?pace=0`，量的時候不會自動降畫質 |
| `node tests/e2e/alloc.mjs` | 開店時誰在製造垃圾（記憶體配置取樣）：開店、全員到齊、×2，跑 `WARM`（預設 60 秒）後取樣 `SPAN`（預設 30 秒），列出每秒配置幾 MB 與配置最多的函式（含呼叫者）。`BASE=http://localhost:4173`（`npx vite preview`）量正式版：dev 模式光 JSX 就多好幾倍 |
| `node tests/e2e/soak.mjs` | 長時間營業會不會越來越卡：開店後每 `SAMPLE`（預設 60 秒）記一行 JSON：回收後的 JS heap、array buffer、FPS、最差的一格、繪製次數、三角面、GPU 的幾何／貼圖／程式數（`MINUTES` 預設 20）；每個數字都應該持平。`BASE=` 同上量正式版 |
| `node tests/e2e/redraws.mjs` | 開店時誰在重畫、為什麼：開店、全員到齊、×2，`WARM`（預設 45 秒）後量 `SPAN`（預設 30 秒）的每一次 React 提交，列出每個元件每秒重畫幾次，以及原因：哪幾個 props 變了（「a new object, same values」＝父層重畫時順便被帶著，自己什麼都沒變，該 memo），或自己的哪個 state 變了（以宣告它的那一行標出）。用 dev server（名稱才看得到） |
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

- 只用 **G** 鍵進出（沒有按鈕）。面板「場景與攝影機」下方顯示整個場景的三角面數（`SceneTally.tsx`，開發者模式開著時每 1.5 秒數一次看得到的網格，含描線）。介面是 Blender 風格的深灰面板：左邊工具列，熱鍵照 Maya（選取 Q、位移 W、旋轉 E、縮放 R；同一個鍵再按一次切換世界／物件座標；4 線框看拓撲、5 回到著色），選到物件時面板顯示它的三角面、頂點、網格數；F 對準選取、A 看全部、Esc 取消選取；視角照 Maya：Alt＋左鍵旋轉、Alt＋中鍵平移、Alt＋右鍵推拉，不按 Alt 拖曳不會動到鏡頭；移動把手中間的橘色小方框可在面向鏡頭的平面上自由移動（三軸一起）；進開發者模式（G）時視角切到 1 自由視角（總覽），離開時鏡頭不動（選單收起不會改構圖）；面板下方列出熱鍵；清單分「場景」「攝影機」兩個頁籤（`edit.ts` 的 `listTab`；點選到的東西在哪一頁就自動切過去），可搜尋（只找目前那一頁），滑鼠滑過清單的某一列時，場景裡那件擺設的框會亮起（群組那列則每件成員都亮），像在場景裡指著它一樣，點下去之前就找得到它在哪（`edit.ts` 的 `setListHot`、`useListHot`：每件只聽自己亮或不亮，滑過時只有那一兩件重畫），變換區的 X／Y／Z 是紅綠藍色條。位置、移動箭頭、旋轉環、縮放把手都用**房間軸**（吧台方向 `ALONG`），不是各物件父層的軸。
- 每件能動的擺設用 `<Movable id label>` 包起來（裡面放自己的 `<StaticBatch>`；Movable 不能放在別的 StaticBatch 裡面）。開發者模式每件物件有一個貼合模型的細線框（`Movable.tsx` 的 `useEditBox`：量模型的頂點，順著物件的斜度找最貼的角度）：平常淡藍、只在沒被擋住處顯示；滑鼠移上去變亮、選到變橘色，這兩種會穿透顯示。點選的是物件本身的網格，所以大物件不會擋住前面的小物件。位置框（量出的範圍）仍用來放箭頭和算中心。
- **預設值**：位置預設寫在 `edit.ts` 的 `BASES`（父層單位）；大小與轉向預設用 `<Movable baseScale baseTurn>`。站在地上的東西加 `ground={地面高度}`（它自己座標裡的地面 y）：縮放以腳底中心為準，放大不會陷進地板（碗盤櫃、冷藏櫃）；不要靠量測（模型晚載入時量到的是預設盒）。定好預設後面板歸零（位置 0、縮放 1）。改了預設要把 `edit.ts` 開頭的三個 localStorage key 版本加一，不然瀏覽器裡舊的偏移會重複計算。有預設轉向或縮放的擺設（例如備長炭籃、行燈），量到中心點之前先不顯示，避免載入時閃一下。
- **編輯介面中日文**：文字在 `data/editText.ts`（`EDIT_TEXT` 中、日各一份，`pieceName` 把擺設名稱翻成日文）；App 用 `setEditLang` 跟著遊戲語言切換。新增擺設時，中文名稱只用中文，並在 `PIECES_JA`（或 `WORDS_JA`）補上日文。
- **座標軸與中心點（像 Maya）**：工具列下方「物／世」切換物件座標（軸跟著擺設自己的方向）與世界座標（整個場景的 X、Y、Z）；每次點選新的物件都先回到物件座標，面板「變換」最上方的色塊（藍＝世界、橘＝物件）隨時顯示目前是哪一種，切換時會跳提示；旋轉值一律記在世界座標裡，切換只改箭頭與位置欄位的軸；位置欄位也跟著換。按 **D**（或工具列的 D）進中心點模式：移動箭頭改成搬中心點（`edit.ts` 的 `pivots`、`setPivot`，存在 localStorage），物件本身不動（自動補償位移），之後旋轉、縮放都繞新中心點；再按 D 回到搬物件。
- **+ / −**：按 X、Y、Z 選軸（再按一次取消），+ 或 − 縮放選到的軸（沒選就三軸一起）；縮放區每軸旁也有 −、+ 按鈕。
- **群組**：清單裡 Ctrl／Shift 點選多件 → 「成組」；群組可一起位移、繞垂直軸轉、整體縮放（轉動中心是成員的中間）。「解散」「改名」「復原」都能用。沒有中心點的東西（閘門）不能成組。預設群組在 `edit.ts` 的 `DEFAULT_GROUPS`（門口招財貓台＋四隻貓 `grp-doorcats`、小神龕的供桌＋供品 `grp-altar`、收銀櫃與上面、裡面的東西和兩張椅子 `grp-till`）；解散後記在 localStorage，不會再自動出現。場景裡點到群組成員會選到整個群組（一起移動、旋轉、縮放），按住 Alt 點才單選那一件。選到群組時，群組中心會出現自己的移動箭頭／旋轉環／縮放把手（`Movable.tsx` 的 `GroupGizmo`，房間軸），旋轉 X、Y、Z 三軸都能調（`Group.r`）。
- **座標歸零**（面板下方按鈕，像 Maya 的 Freeze Transformations）：把選到的物件或群組現在的位置、旋轉、大小當成新的 0／1，物件不動，之後面板從這裡算（`edit.ts` 的 `freezeSelected`、`zeroOf`，存在 localStorage `jgs-edit-frozen-1`；「全部還原」會一起清掉）。BDD：`tests/bdd/edit-freeze.test.ts`。
- 面板的標題列可以拖曳移動（位置存在 localStorage `jgs-edit-panel-pos`）。
- **渲染**（面板的「渲染」區塊）：逐件設定選到的擺設怎麼畫：光影（平滑／平面）、材質（原本／卡通／寫實／無光）、描線（開／關）、投影、受影（開／關）；選到群組就套用到每個成員。只存跟原本不同的設定（localStorage `jgs-edit-render-1`，「還原這件的渲染」或「全部還原」清掉）。規則是純邏輯 `game/renderPrefs.ts`（BDD `render-prefs`）；`shops/grill/renderPrefs.ts` 的 `RenderPrefsApply`（掛在 App 的場景裡）照每個網格最近的 Movable（`userData.editId`）套上去：設定一變就套，有設定時每秒再掃一次（後來才載入的東西）；換掉的材質依原材質做一次共用，原本的材質記在網格上，還原時換回去。
- 進開發者模式會自動收起選單，離開後還原；選單收放或離開開發者模式不會讓鏡頭重新歸位（只有換菜、重設視角、總覽、視窗大小改變、進開發者模式才會；進開發者模式一律切到自由視角）。

## 廚房三種模式（`game/mode.ts`）

- **三個視角**：攝影機 1＝研製（鎖定）、攝影機 2＝開發者模式（總覽、自由拖）、攝影機 3＝自由視角（閉店預設）。
- **研製＝火烤灶台視角**：閉店時鏡頭在視角 2（火烤灶台）就是研製模式（`App.tsx` 的 `research = !ai && view === 'grill'`），換到其他視角就離開；營業時沒有研製。研製時右上角（編輯鈕左邊）有一個冷藏櫃小圖示（`fridge-toggle`），點一下開關右側的食材櫃（`ui/Menu.tsx` 的 `chiller`）。食材櫃分三區：冷凍、冷藏、常溫（`data/storage.ts` 的 `storageOf`；清酒、馬鈴薯、地瓜是常溫），**在房間裡點食材冷凍櫃（打開時）也會打開食材櫃**：閉店時鏡頭切到火烤灶台並開啟（`bar.ts` 的 `askPantry`、App 的 `onPantryAsk`），營業中只開蓋；底部是試做數量、全部放回，與三個補貨鍵：補到平均（`averageOrder`）、各補 5（`eachOrder`）、補滿（`topUpOrder`，補到 `PAR`）；BDD `tests/bdd/fridge.test.ts`。沒有手動烤魚。**研製**：視角固定在**攝影機 1**，手動夾食物、調味、看每塊的烤魚進度（`roast-tag`）。**營業**（店開著）：廚房自己烤（AI 主廚永遠工作，雇的員工一起），沒有手動烤魚與調味、沒有進度標籤、沒有食材櫃。規則都在 `game/mode.ts`（`modeOf(shopOpen, research)`、`canCookByHand`、`showsProgress`、`showsStockFridge`、`holdsCameraOne`；BDD 情境 `tests/bdd/mode.test.ts`）。
- **Esc** 關掉目前開著的介面（由上而下：辦公室、看板、工具選單、食材櫃、視角選單；開發者模式與收銀機說明書自己處理）。
- **帳本**是「經營」（`ui/Office.tsx`）的第三個頁籤「帳簿」（現金、開業費用、採買、收銀機取款、供品、營業額、食材、燃料、人事、利潤、利潤率）；右上角沒有「帳」按鈕。
- 客人看板（掌廚、來客、在座、最近四位的心情，`guest-board`）只在手機版顯示；電腦上客人就在 3D 吧台。
- **試吃**：研製時點試吃碗裡烤好的東西，老闆會沿他的走道走到最靠近碗的地方、轉向它、說一句（`data/bossLines.ts` 的 `TASTE_LINES`），把它拿到嘴邊吃完，再跑回原本的作息（`Boss.tsx` 的 `BOSS_TASTE`；Roasting 的 `awaitBoss`、`byBoss`）。一次一份。每咬一口有咔滋聲、咬與咬之間有咀嚼聲（`shops/grill/chewSound.ts`，WebAudio 即時合成），咬下第一口時台詞換成嚼東西的（`MUNCH_LINES`，`BOSS_TASTE.chewing`），吃完依美味給評語（`tasteVerdict`：80 以上很好吃、60 好吃、35 普通、以下難吃；`VERDICT_LINES`，`BOSS_TASTE.verdict`；BDD `boss-taste`）。
- 廚師只是偶爾搧火：一段時間拿著扇子搧，再放下站著（`Person3D.tsx` 的 `fanning`），每人錯開。
- 老闆擋住鏡頭看的東西時會變淡（只在他真的蓋住畫面中央附近時），用 `alphaHash` 抖動透明，不會變黑或透出身體內部。
- 灶台桌上只有試吃碗（碗公）是常駐的碗盤：沒有備用盤疊（Roasting 的 `SPARES` 空的）；盤子（`plate-n`）、小碟（`dish-n`）、飯糰的小碟（`rawdish`）都在桌面上，只有裝著東西時才出現（`WhenHeld`）；飯桶台的下層不再放碗。
- 研製時：點冷藏櫃拿的食材**直接出現在大砧板（`tray`）上**（`Piece.fresh`，不從火堆滑過去）；砧板最多放兩層：下層 5 支、上層 4 支卡在縫裡（Roasting 的 `TRAY_ROWS`、`TRAY_CAP`），散裝的一排 7 個（`LOOSE_CAP`），多的先留在冷藏櫃（不顯示），砧板空出位置才拿出來，砧板角落標「+n 冷藏」（`tray-more`）。
- **調味的手感**：拿著調味停在食物上方就會一直撒（`toolAction`：鹽用手指搓、粉類抖湯匙、醬料刷子來回刷、醬類點上去、檸檬擠），顆粒依速度均勻落下；停在一塊上 `DAB_FIRST`（0.25 秒）就調一次，之後每 `DAB_EVERY`（0.7 秒）一次（換到別塊也不會更快）；每調一次：食物彈一下（`BOUNCE`）、地上擴散一圈調味顏色的光圈（`RINGS`）、一個聲音（`seasonSound.ts`：粉類沙沙聲、醬類濕的一點、檸檬擠汁；撒粉時還有細碎的顆粒聲 `sprinkleTick`），跳出「美味 ±n」；放開時這塊若已經調過就不再加。烤好夾起的食物**一律放進桌上的試吃碗**（`bowl-0`、`TasteBowl`、`inBowl`，排法同盤子）。
- **攝影機 1**：該道菜的 home 視角（`App.tsx` 的 home），研製時鎖在這裡；開發者模式不再能調整它（`scene/camera1.ts` 的偏移仍會讀，但沒有編輯介面）。dev 時 `window.__freeCam = true` 可以解鎖視角做截圖。
- **視角選單**（左下眼睛鈕）：`data/views.ts` 的 `VIEW_SPOTS`，依序 1 自由視角、2 火烤灶台、3 櫃檯、4 玄關、5 小神龕、6 飲品櫃、7 廁所、8 後台區（看兩組碗盤架之間的 `look-back`）、9 窗口（圓窗，`look-window`）、10 老闆（`follow`：老闆的第一人稱、廣角 `WIDE_FOV`，跟著他走，閉店時才有）；各區看向一個具名群組（`TillMarble`、`look-door`、`look-altar`、`look-fridge`、`look-wc-m`、`look-back`），預設鏡頭從房間剖開的那一側（總覽的方向）、往後 `back`、往上 `up` 看過去（`App.tsx` 的 `poseOf`）；`from` 可指定別的方向、`shift` 把看的點往房內移（玄關在剖開的牆邊，用這兩個避免拍到外面的空白）；老闆視角從他眼睛的高度看著火爐。打開選單時場景裡同時標出編號圈圈（`ViewMarkers`，像 Sketchfab 的註記，點一下飛過去）；選單開著時點畫面其他地方（不是拖曳轉視角）就收起。**除了 1 自由視角，其他視角都鎖定**（不能轉、平移、縮放；App 的 `spotLock`；研製的火烤灶台另由 `lockView` 鎖在攝影機 1），開發者模式不鎖。鎖定的視角都有四周模糊＋昏暗的鏡頭效果（CSS 疊層 `.grill-focus`，研製時焦點在火上，其他視角 `is-centered` 在畫面中央），自由視角、老闆視角與開發者模式沒有。開發者模式下每個視角是一台攝影機（`ViewCams`，Movable id `viewcam-<id>`），可調位置與旋轉；調過的視角就從那台攝影機的位置、朝它指的方向看（`viewCamPlaced`）。自由視角的攝影機預設就調過：物件座標 X -0.45、旋轉 Y 15° Z 5°（位置在 `edit.ts` 的 `BASES['viewcam-free']`，轉向在 App 的 `VIEWCAM_TURN`，面板「還原」回到這裡）。
- **開發者模式只做編輯**：場景裡所有互動（夾食物、添炭、調味、澆水、收銀抽屜、廁所門、飲料櫃門、神棚、飯桶蓋、盤子拖曳）都擋掉（Roasting 的 `locked`、各元件的 `getEdit().on`、App 對 `.canvas-layer` 的 click 攔截）。
- 桌上的**行燈、團扇**用 `<Movable>` 包起來；**大砧板（`cutboard`）、調味架（`seasoning`）、水桶（`bucket`）**是由桌面的 nudge（`moved`）定位的，開發者模式用 `EditProxy`（不畫出來的同尺寸方塊）給框與箭頭，位移量會加進 nudge（食物、鍋具、水瓢跟著走）；這三件只有位移有效，旋轉與縮放沒有作用。
- **能互動的東西都要有名稱標籤**：滑鼠移上去，游標旁出現和備長炭同款的紙標籤（名字＋做法）。3D 物件用 `shops/grill/bar.ts` 的 `tipOver(名稱, 提示)` 取代 `handOver`（會發亮、變手指、設標籤）；標籤的狀態在 `scene/hoverTip.ts`，由 `ui/HoverTip.tsx` 畫（開發者模式隱藏）。不能放在 `StaticBatch` 裡（合併後沒有事件）；門這類小目標用一片透明的感應面（見 `ToiletHit`）。目前沒有標籤的：招財貓、客人、食材冷藏櫃的蓋子（沒有互動）。
- **電燈開關**（客席後牆、手的高度，在圓窗與它右邊那幅（深夜食堂看板）中間（DiningRoom 的 `switchZ`），`blender/lightswitch.py` → `lightswitch.glb`，`DiningRoom.tsx` 的 `LightSwitch`，Movable `lightswitch`）：點一下關燈、再點一下開燈（規則 `game/roomLights.ts`，BDD `room-lights`；狀態 `scene/lightsStore.ts`，存 localStorage `jgs-lights-1`）。關燈時吊燈與燈串變成沒點亮的紙與燈泡（灰白，不是黃的：`game/roomLights.ts` 的 `unlitShade`，白天 `#d4d2cd`、晚上 `#58585b`，BDD；`shops/grill/lampShades.ts` 的 `lampLit` 把燈罩的貼圖換成一張沒有光的和紙 `LANTERN_SKIN_OFF`，燈泡、玻璃球用同一個灰再暗一點；以前只是把點亮時畫著暖光的黃色貼圖調暗，熄了還是黃的；收銀台側面的紙燈窗換成白和紙、竹子後面的燈一起熄）、光暈與桌上的光圈消失（`nightGlow` 的 `lamp`；窗外的天光不受影響）、灶台上方的暖色聚光燈熄、店裡的環境光降到 `roomDim`（白天剩窗外的天光，晚上連代表月光的主光一起暗，只剩爐火、行燈與飲料櫃的光）；關燈時開關上的小綠燈（ホタル）亮著，黑暗中找得到。
- **夜晚與電燈開關**（`game/roomLights.ts`，BDD `room-lights`）：關燈時吊燈、燈串不發光（燈罩換成沒點的紙色）；**金屬的反光跟著店裡的光**（`studioLight`：白天開燈 1、晚上 0.6、白天關燈 0.5、晚上關燈 0.1；`scene/studio.ts` 的 `setStudioLight` 調整所有 `reflectStudio` 材質的 `envMapIntensity`）；**晚上的主光是月光，從圓窗照進來**（App 的 `keyLight` 每半秒找 `RoundWindow`，從它外側高處、很陡地打光，影子短、往遠離窗戶的方向落）；**白天是日正當中的太陽，從正上方 90 度照下來**（店主定的：影子只落在東西正下方，不會斜斜投到牆上、神龕上；`roomLights.ts` 的 `keyLightFrom`，BDD `room-lights`；以前白天也從圓窗斜照）；影子深淺 `shadow.intensity`（`shadowDepth`）：晚上開燈 0.28（燈把影子補亮）、關燈 0.75；白天開燈 0.5、關燈 0.62（以前白天是 1，影子黑到底、邊緣一刀切，店主說不自然）；影子邊緣糊開 `shadowSoft`（晚上 5、白天 8 格陰影貼圖，一格約 1.4 公分，App 每半秒設 `shadow.radius`；three r186 的 PCF 是 5 點 Vogel 圓盤，半徑只放大取樣距離，不多花時間）；**圓窗只有晚上有淡藍光暈、光束與飄浮的塵埃**（`WINDOW_HALO`、`SUNBEAM` 白天 0；光束從窗邊淡入，不露硬邊；`WindowDust` 在 StaticBatch 外面，跟著窗戶的 Movable）；**關燈後行燈是灶台唯一的光**：更亮、照得更遠（Decor 的 `boost`，晚上 3.2 倍）；**飲料櫃自己的燈**一直亮（兩台共用一盞，放在兩台中間；畫在 GuestBar3D、不在延後載入的飲料櫃裡：**場景中途多一盞燈，所有材質都要重新編譯，會卡一下**，所以燈要從一開始就在）；飲料櫃的玻璃不投影也不接收陰影（以前打開的玻璃門在地上和櫃子側面留下一塊實心的影子）。App 那片只顯示陰影的隱形地板，有自己房間的店不畫（它在灶台桌面的高度橫過整個場景，月光從窗戶來時把房間的影子投到店外的半空中）。**客人對黑暗的反應**（`roomMood`：`lit`／`dim`／`dark`）：晚上關燈沒有新客人進來（`comesIn`），在座的說一句「好暗喔……」（`dark`），耐心只剩 0.35（`patienceIn`），等不到就說 `darkGone` 走人；白天關燈耐心 0.8。dev 時 `__lights.press()` 按開關。
- **牆角喇叭**（`DiningRoom.tsx` 的 `WallSpeaker`）是音樂唯一的開關：點一下開、再點一下關，預設關（`ui/bgmStore.ts`，`ui/Bgm.tsx` 負責播放，音量固定）；hover 會發亮並出現「音箱／點一下開啟（關閉）音樂」標籤，開著時飄出音符（`MusicNotes`）。沒有任何音樂的 2D 介面或按鈕。
- **地瓜與馬鈴薯的麻袋**（`blender/produce.py` → `produce.glb`，`KitchenStores.tsx` 的 `ProduceSacks`，Decor 的 `SacksAt`、`SACKS_AT`，Movable `produce`「地瓜馬鈴薯」）：側吧台朝廚房那一面的地上、閘門與灶台桌之間，三個麻袋背靠吧台（兩袋馬鈴薯、一袋地瓜（織進一圈紅線）），袋口往外捲成一圈粗邊、裡面的東西堆到袋口，前面滾出幾顆；離灶台夠遠，左邊櫃子的門打得開。麻袋身與捲邊是兩個各自朝外的面（以前一片布往外翻，翻過來的那半是反面，袋身變黑）；袋子的材質雙面畫（看得到袋口裡面）。外場走廚房會繞開它（GuestBar3D 的 `KITCHEN_BLOCKS`）。
- **客人的盤子**：`shops/grill/wareDesigns.ts` 五款花色（唐草、青海波、鯉魚、梅花藍底、風車）依盤子輪流用；竹、梅仍是 `ware.ts` 的大盤與小碟。`PlateRack.tsx` 是碗盤櫃架（Decor 裡的 `RackAt`）。
- **開發者模式左下角**有世界座標小圖（`App.tsx` 的 `AxisWidget`）：X 沿吧台、Y 向上、Z 橫過吧台，隨鏡頭轉。
- **右上角（寬螢幕）**：沒有「經營」按鈕；金額是一塊毛玻璃（`.money-chip`），點它打開經營視窗，頁籤依序 帳簿、人事、廚房（視窗標題列不再重複顯示現金）；手機仍用經營按鈕。e2e 從 `.money-chip` 進經營，廚房是第 3 個頁籤。**英文介面**：字型 Cormorant Garamond（`html[lang='en']` 換掉 `--brush`），右側直式標題只留一個（不再加小字的英文）。
- **逃生出口燈**（`blender/exitsign.py` → `exitsign.glb`，DiningRoom 的 `ExitSign`、Movable `exitsign`，`look-exit`）：照台灣常見的導光板款式：上方一條鋁擠型燈座（真金屬、反射 studio），下面吊一片壓克力導光板，邊緣微亮；板面兩面都畫（`exitFace`：綠底，左邊 EXIT、中間白色門框與往外跑的人形、右邊跟著語系的字：緊急出口／非常口／WAY OUT，`useDocLang` 跟著 `<html lang>` 換），一直亮著（不受電燈開關影響），周圍淡淡的綠光；掛在神龕上方、門口那頭的波浪飾帶上。
- **牆角喇叭的外觀**：機身、網罩、支臂改成炭灰色（模型原本近黑，卡通光影下變成一塊沒有形狀的黑洞），整體 0.82 倍。
- **左上角的招牌**（`ui/Brand.tsx`）：維持原本的樣子。2026-11-01 試過整塊重畫成一張 SVG 的魚形櫸木板（金箔字、木紋、鱗片、夜晚發光，commit 7150cd1），店主覺得不好看，已還原；不要再改成那一版。
- **介面風格**：木紋深色外框與標題列、半透明淺色面板（`index.css` 末尾的 `--grain-dark`、`--grain-light`）；只是按的東西（食材卡、補貨鈕）用半透明玻璃，不用木色。
- **HDRI**：`scene/IndoorHDRI.tsx` 在 `public/hdris/` 找真的 HDRI（夜晚 `grill_night_1k.exr`、`night.exr`、`night.hdr`；白天 `grill_day_1k.exr`、`day.exr`、`day.hdr`，.exr 或 .hdr 都可以），沒有就用內建的假 HDRI。**BGM**：`ui/Bgm.tsx` 播 `public/music/IzakayaNight.mp3`。

## 常見改動要碰哪裡

- **加一道食材**：在 `data/menu.ts` 的店家 `items` 加一筆；成本比例加在 `game/economy.ts` 的 `COST_SHARE`；燒烤類要在 `game/taste.ts` 的 `PAIRING` 加上調味搭配（調味的最佳時機在 `TIMING`）；有特別菜名的話加在 `data/recipes.ts`（`SPECIAL` / `BREAD`）。燒烤的 3D 模型由 `blender/grilledfish.py` 產生。
- **調整價格或成本**：`game/economy.ts`（`costOf`、`COST_SHARE`、`CAPITAL`、`SHOP_COST`）和 `data/recipes.ts` 的 `suggestPrice`、`SEASON_COST`。
- **開店門檻和菜單上限**：`data/recipes.ts` 的 `MENU_MIN`、`MENU_MAX`。
- **員工編制**：`data/staff.ts` 的 `ROLES`（二廚、三廚、外場 ×2、收銀、倉儲）。倉儲自動補貨的規則在 `game/economy.ts` 的 `restockOrder`。應徵者每局隨機產生（`game/hiring.ts`），姓名、背景、個性的詞庫在 `data/people.ts`。
- **加一間店**：`data/menu.ts` 加一個 Dish，`src/shops/<新店>/` 放它的 3D，`App.tsx` 的 Scene 掛上去，`data/staff.ts`、`data/recipes.ts` 補上它的資料，並在 `tests/architecture.test.ts` 的 `ALLOWED` 加上新資料夾。

## 3D 模型

- **減面（不影響畫面）**：`blender/optimize_glb.py -- <輸入.glb> <輸出.glb> '{"名稱正規式": 保留比例}'`：先合併同平面的面（看不出差別），再把超過 1500 面的零件減到比例（最少留 600 面），保留 UV 與材質邊界；貼圖以品質 95 重存。**每個減過的模型都要近拍前後對照**，看得出差別就不用。目前用過：`kamidana.glb`（6.7 萬 → 3.2 萬）、`freezer.glb`（1.45 萬 → 5.7 千）、`speaker.glb`（2.07 萬 → 1.41 萬），規則都是 `{".*": 0.35}`；**重新跑這三個的產生腳本後要再跑一次減面**。試過但退回的：菰樽（繩子變扁、桶身出現接縫）、武士頭盔（筋紋變淡）、招財樹與元寶（用這支工具看不出省多少；後來改在 `blender/tilldesk.py` 從源頭減：細線的圓周段數與曲線解析度依粗細與長度、葉片 4 段、石子 8 邊、元寶 44 段，招財樹 3.5 萬 → 1.8 萬、元寶 2.3 萬 → 1.1 萬，看起來一樣）。
- 模型由 `blender/*.py`（Blender 5.2）產生，輸出到 `public/models/*.glb`；手機版用 `blender/make_lite.py` 產生 `*-lite.glb`。兩個版本都要更新。
- 執行：`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/grilledfish.py -- <專案路徑>`
- 下載來的模型（魚、冰箱、招財貓）貼圖用 `blender/shrink_textures.py -- <檔案.glb>…` 縮到 1024 px 並轉 JPEG（只換圖，網格不動）；新加入的外部模型也要跑一次。
- 喇叭（`blender/speaker.py` → `speaker.glb`）與收銀機（`blender/register.py` → `register.glb`，節點 `RegBody` 固定、`RegDrawer` 由遊戲滑出；顯示幕數字、發票、抽屜裡的錢仍由程式畫）也是 Blender 產生；兩者只在 3D 吧台出現，沒有 lite 版。描邊用 `inkModel(root, skip, { width, weld: true })`（細線、平滑法線，硬邊模型不會裂開）。
- 收銀機可以操作（`shops/grill/cashRegister.tsx`）：按鍵（模型節點 `Key_<鍵名>`）與模式鎖（`RegModeKey`，OFF→REG→X→Z）照 `game/register.ts` 的純邏輯運作（BDD：`tests/bdd/register.test.ts`），印出的發票是 `drawReceipt` 畫的；客人結帳時收銀員自動按鍵並記入營業額。dev 時 `__register` 看狀態。r3f 的 `<primitive>` 上的事件不會生效，互動要包一層 `<group>`。
- 收銀櫃上的平板（`blender/ipad.py` → `ipad.glb`，`shops/grill/Ipad.tsx`；螢幕節點 `IpadScreen` 貼遊戲的點單畫面）與下層的紙箱和說明書（`blender/tillboxes.py` → `tillboxes.glb`，`TillBoxes.tsx`；點說明書 `TillManual` 打開 `ui/RegisterManual.tsx`，內容在 `data/registerManual.ts`）。
- 收銀櫃檯本體（`blender/tillcounter.py` → `tillcounter.glb`，`TillCounter.tsx`）：深色木櫃；客人側正面是鬆散不規則的綠竹（每根粗細、傾斜、彎度、竹節、色調（`TillBamboo0`～`4`，`TillCounter.tsx` 的 `BAMBOO_SHADES`）都不同，竹節是一圈細深線加淺色唇，上下兩根橫竹用黑繩綁），後面一片暖光面 `TillBambooGlow` 從竹縫透出；側面圓窗是紙燈（窗紙 `TillWindowPaper` 內退、由裡發光，窗框、內襯、格子是淺色櫸木）；白色大理石檯面（亮面）；隔板是胡桃木立格子（底下深銅色踢腳、上下橫框、立柱、壓頂，格子後面是淺色檜木板，兩個開口端是帶圓頂的圓柱；踢腳、橫框、壓頂沿一條帶圓角的路徑一體成型 `sweep`，轉角是圓柱，沒有接縫），客人側左端（服務鈴那頭）留空，招財貓那端一路延伸到收銀員側邊緣。
- 收銀櫃上的小東西（`blender/tilldesk.py` → `tilldesk.glb`，`shops/grill/TillDesk.tsx`）：筆筒 `TillPens`、明細印表機 `TillPrinter`、刷卡機 `TillCardReader`（桌上型：斜面機身、灰色液晶、導覽鍵、橡膠數字鍵、紅黃綠鍵、內建出單機，前端插著一張卡）、服務鈴 `TillBell`、胡桃木台座 `TillMat`（15 cm 高，正面兩個抽屜、黃銅把手）、找零盤（カルトン）`TillTray`、招財貓石座 `TillCatStand`，各自一個 Movable；服務鈴可以按（`TillBellLive`：按壓桿 `TillBellPlunger` 下壓、叮一聲）。放在台座上的（平板、筆筒、印表機、刷卡機）在 `edit.ts` 的 `BASES` 裡 y 墊高 0.15；它們的線各自收進身後桌墊上的小孔（模型的一部分，跟著移動），平板的線藏在支架裡，收銀機的電源線從機身背後收進機身下的走線孔。**編輯面板顯示的是房間座標，`BASES` 存的是父層座標，寫預設前要用 `fromRoom(id, v)` 換算。**
- **客人（老闆款）**：跟老闆、店員同一個風格與身高（`blender/folk.py` → `public/models/folk.glb`，`scene/FolkFigure.tsx`；GuestBar3D 的 `FOLK_GUESTS`，網址加 `?guests=old` 換回舊的 `guests.glb` 客人）。原則是**低面數＋平滑光影＋貼圖**：身體是 24 段的車削體，衣服整件畫成一張貼圖（`public/textures/folk/outfit_<種類>_<0|1>.png`，16 種客人各兩種配色：西裝領帶、水手服、立領學生服金扣、浴衣腰帶、女僕圍裙…）；臉是頭前方一片貼圖，8 種表情排成一條（`face_<male|female|elder|kid>.png`：平常、眨眼、開心、生氣、難過、咀嚼、說話、驚訝），換表情只是滑動貼圖；14 種髮型（`Folk_hair_<款>`；刺刺頭 `spiky` 是從頭頂順著頭形梳下來、末端翹起成尖的髮束（`folk.py` 的 `clump`：瀏海幾撮尖、兩鬢、耳上、後腦一路到髮尾、頭頂與後腦幾撮翹起），以前是一圈圓錐直直插在光滑的頭殼上，像刺蝟；dev 時網址加 `?hair=<款>` 讓所有客人都換成那個髮型，方便檢查）與配件（`Folk_acc_<名>`：眼鏡、鬍子、耳機、遮陽帽與相機、黃色小學生帽與書包、背包、女僕頭飾、暴走族頭巾、大圈耳環、浴衣蝴蝶結與花簪、披肩、毛巾、立領）依種類與 id 選（`HAIR`、`ACC`）；膚色、髮色照舊的 `lookOf`。每種髮型＋配件組合只建一次（身體、頭、兩手各依材質合併、描線），再複製給每位客人（各自的材質，才能各自淡出）。坐下時圓身體坐在高腳椅坐墊上（`SEAT`），吃飯左手端碗、右手筷子送到嘴邊；滑手機、托腮、跟同伴說話時身體轉向對方、上菜時跳一下、心情在臉上。每位約 3,000 個三角面。只有顏色、沒有貼圖的部分（配件、包包、帽子、手機、腰帶…，`PAINTED` 以外的）共用一個材質 `FolkPlain`、顏色寫在頂點上，每個部位（身體、頭、兩手）的描線合成一條（`inkTogether`）：每位 15～19 → 11～14 次繪製（依手上拿的東西）。頭（臉、頭髮、頭上的配件）不接收陰影（整間店一張陰影圖太粗，頭髮、帽子的影子落在臉上成一塊塊、一條條），只靠卡通光影。貼圖在開頭就預載（`useLoader.preload`），每位客人自己一個 Suspense，載入中不會讓整個場景消失。
- 舊客人（十五種 Q 版角色、每種有幾種髮型隨機搭配、共用一副骨架，動作 Sit／Eat／Walk；出現比例是 `data/guests.ts` 的 `weight`）由 `blender/guests.py` 產生 `public/models/guests.glb`，`scene/Person3D.tsx` 載入後依客人換膚色、髮色、衣服顏色與花紋。手機不跑 3D 吧台，所以沒有 lite 版。
  - 店員（二廚、三廚、外場、收銀、倉儲）不用 guests.glb：是老闆的同一個 Blender 腳本換裝（`CREW=<款式> blender … --python blender/boss.py` → `public/models/crew_<款式>.glb`：`chef` 白割烹著＋白頭巾帽＋深藍圍裙、`chefF` 女廚師（低髮髻）、`server` 靛藍作務衣（刺子格紋）＋白鉢卷＋短圍裙、`serverF` 紫紅和服（梅花紋）＋金腰帶（背後太鼓結、紅帶締）＋高髮髻與紅梳、`stock` 卡其工作服＋白鉢卷＋脖子上的毛巾＋工作手套），節點名稱與老闆相同（`BossHandL` 等）。年輕的臉：小鼻子、眼睛稍大、細短的眉、腮紅；女性有睫毛、玫瑰色的嘴、齊瀏海與鬢角。遊戲裡是 `scene/StaffFigure.tsx`：膚色、髮色、眼鏡照辦公室頭像（同一個 id 雜湊；`CrewSkin`、`CrewHair` 兩個材質由遊戲上色），每款只建一次（身體依材質合併、眼睛、眼鏡、兩手各自一組，描一次線），再複製；走路像老闆一樣搖擺，外場端托盤、倉儲拿板夾、廚師偶爾搧火（`TRAY_AT` 是托盤／板夾在手上的位置）。客人仍用 guests.glb、保留短腿（要坐吧台高腳椅）。
  - 老闆與店員的面數：`boss.py` 每顆球、每條管、每個車削體都只用約 6 成的段數（`LOD`、`uv_sphere`），老闆 18,800 → 8,600 個三角面，店員各約 8,000。繪製次數：沒有貼圖、只有顏色的部分（繩子、領子、眉毛、毛巾、腰帶…）共用一個材質，顏色寫在頂點上（`StaffFigure.tsx` 的 `colourVertices`、Boss 的 `plain`，`vertexColors`），合起來只畫一次；膚色、髮色（每人不同）與有貼圖的布各自保留；每個部位（身體、每隻手、眼睛）的描線合成一條（`inkHull.ts` 的 `inkTogether`）。主廚 38 → 22 次、收銀 28 → 17、老闆 36 → 25，看起來一樣（`StaticBatch` 的 `bakeable` 會一起帶著頂點顏色）。
  - 頭髮：`cap()` 預設把髮殼鋪成貼著頭的網格（每一欄從頭頂到 keep() 的髮際線），髮際線是平順的線，不是沿頭部網格的鋸齒；頭巾、帽緣用 `surf_ring` 沿頭型繞一圈。身上不同顏色的交界由 `smooth_seams` 拉平，脖子處加一圈同色的滾邊。頭飾的三角面預算在檔尾 `BUDGET`（太低會被減面成碎片）。
  - 預覽單一角色的頭部特寫：`PREVIEW_KIND="chef,crop;staffF,bun" PREVIEW_YAW="25;160" blender -b --factory-startup --python blender/guests.py -- <輸出專案路徑> <圖檔.png>`（每個角色每個角度一張；輸出專案路徑可指到暫存資料夾，避免動到正式的 glb）。

- 食材櫃卡片的食材圖是 `ui/FoodArt.tsx` 手繪的 SVG（不用圖片），畫風照員工大頭貼（`ui/Avatar`）：平塗、明暗是俐落的兩階色塊、白色小反光、同一種墨線、不畫影子。**整條魚**每種有自己的身形參數（`FISH`：多深、最深處在哪、肚子多飽、尾柄多細，身體用平滑曲線 `smoothPath` 穿過這些點畫出），背到腹的光澤漸層、背腹交界一條銀線、背上鱗片、長條高光、腹下陰影、鰓蓋與鰓縫；各自的鰭（`dorsal`、`anal`、`adipose`、`finlets`、`fork`）與特徵：香魚高背鰭、脂鰭與金斑，秋刀魚的黃色下顎尖與尾前小鰭，鯖魚的硬棘背鰭、小鰭與波紋，竹筴魚的稜鱗與黃線，沙丁魚的黑點，柳葉魚的雀斑與魚卵，花魚的條紋與長背鰭，鰤魚的黃線與黃尾，紅喉的紅身大眼；**切身**是有厚度的肉塊（鮭魚的波浪油花、銀鱈的肉紋，皮與皮下深色肉）；其他食材各自一張（玉米粒、香菇十字刀、魷魚格紋…）。卡片上方的帶狀圖依各自的外框裁切。菜單直條上方也用同一張圖（`ui/Menu.tsx` 的 `StripArt`：研發出來的菜用它的主食材，套餐用它的魚；沒有圖的才用 `ui/Icon` 的線條圖示）。全部食材大圖一頁檢查：`npx vite-node tests/visual/foodsheet.tsx <輸出.html>`（同一次 render，漸層與裁切的 id 才不會重複）。`public/icons/food/*.png`（`blender/food_icons.py`）已不用。
- **灶台桌面以下是白色大理石**（`blender/marbletex.py` → `public/textures/marble_panel.jpg`：霧面白大理石、斜向流動的灰色紋理，可四方連續；Roasting 的 `COOK_MARBLE`）：桌身（`CookTableBox`）整片大理石，桌下櫃門是大理石門板配深色杉木框。
- 客席牆面的貼圖是 `blender/walltex.py` 產生的（DiningRoom 的 `fileTex`、`WallPiece`，上下左右都能無縫接）：上半部 `plaster_wall.jpg`（聚楽壁：米色土牆、斑駁、細砂、鏝刀痕、短稻草，每 1.2 一格）；下半部腰板 `wainscot_boards.jpg`（一格 1.44 寬、腰板高 0.85，十二片直立木板，每片色調不同，多數板目（山形紋朝上、紋路會飄）、少數柾目（細直紋），幾個節，靠地面稍暗，板縫是 V 溝；格子寬，沿牆不會幾步就重複）。
- 料理台的木紋是 `blender/woodtex.py` 產生的貼圖（`public/textures/keyaki_top.jpg`：四片櫸木拼板、山形紋，每 1.6 單位一格；`cedar_panel.jpg`：台身的直立杉木板＋框），Roasting 的 `woodTex`、`panelBox`（依面寬給 UV，木板不會被拉長）；台身腳下一條深色踢腳。烤網架高（`grilledfish.py` 的 `NET_Z`，網上的食物跟著）。
- 食材冷凍櫃（`blender/freezer.py` → `freezer.glb`，Decor 的 `IngredientFridge`）：節點 `FreezerBody`、`FreezerLid`（鉸鏈在後緣，遊戲掀起）、`FreezerGoods`（打開要豐富：冰衣整魚、真空包魚片、保麗龍魚箱、網籃裡的秋刀魚、冰塊；底下一層庫存箱，看起來半滿）；外觀保持乾淨：不描黑線，只有格柵、溫控（顯示幕顯示櫃內溫度，下方旋鈕 `FreezerKnob`：點左半邊調冷、右半邊調暖或用滾輪，一次 1℃，-25～-15℃，預設 -20℃，設定存 localStorage `jgs-freezer-temp-1`；開蓋時櫃內慢慢回溫、關上後回到設定；邏輯在 `game/freezer.ts`，BDD `freezer`）與紅色玻璃燈泡（遊戲裡畫，會發光）；開口的鍍鉻邊框是一整圈、從機身外緣內縮，角落不凸出，不加多餘小零件；點一下開／關（`FREEZER.open`），拿食材時也會自己掀一下。
- 灶台桌前緣的缺口（`bar.ts` 的 `COOK_NOTCH`）是老闆站著烤的地方，夠一個人站進去；東西不會放在缺口上方（Roasting 的 `clearOfHearth` 也把東西推出缺口）；兩側的櫃子（`CUBBY`、`CUBBY2`）都是左右對開的兩扇門（`CubbyDoors` 的 `hinge="both"`，鉸鏈在櫃子兩端、往外打開、稍微超過直角 `LEAF_SWING`）；缺口正面（灶台下）沒有櫃子，就是桌身本身（以前多貼了一片大理石板 `NotchFace`，店主不要），刀架直接鎖在上面。門是大理石門板配深色杉木框，內嵌橢圓把手；滑鼠移上去打開一下，點一下保持開著；滑鼠停在櫃子開口裡時門不會關。**門不會打到人**：老闆、廚師、外場各自把自己的人放進 `bar.ts` 的 `KITCHEN_FOLK`；有人站在門的擺動範圍內（`fromSwing`，距離 < `DOOR_ROOM`），或照他走的速度一下子就會走進來（往前看 `DOOR_AHEAD` 秒、最多 `DOOR_AHEAD_MAX`），門就不開、開著的會很快關上（`blocked`，標籤顯示「前面有人，打不開」），人走過後原本點開的會再打開；營業時老闆站在右邊櫃子前，所以那時右邊打不開。dev 時 `__cubbies.left`／`right` 看狀態。**櫃子裡放的東西**（`blender/cubbystock.py` → `cubbystock.glb`，`shops/grill/KitchenStores.tsx` 的 `CubbyStock`，各自站在櫃子的底板中央）：右邊 `StockRight`（醬油與味醂一升瓶、醃菜甕壓著石頭、一疊布巾、杉木鹽箱、層板下的紙箱、層板上三罐香料與一罐麻油）；左邊 `StockLeft`（備長炭紙箱與起火壺、層板上兩綑綁麻繩的鐵串、鋁箔盒、小托盤上三顆檸檬）。盤子不放櫃子裡（都在碗盤櫃）。兩側的櫃子裡在頂板下有一條暖色燈條（`CubbyDoors` 的 `lit`）：門打開時亮起、照亮裡面（高畫質多一盞小燈），關門就熄，不會從門縫漏光。廚餘桶（`trash`）與竹籃（`basket-0`）在桌面左端（`data/menu.ts`），不在櫃子裡。
- 店內的菰樽（草蓆包的清酒桶，一疊三個，約 1.1 高）是 `blender/komodaru.py` → `komodaru.glb`（`DiningRoom.tsx` 的 `SakeStack`，整疊約 9,600 個三角面：桶身 32×10 段、草繩斷面 8 邊）：桶蓋邊緣是一圈稻草末端（`KomoFringe`：96 片扁平草片，往外翻、垂過邊緣，兩面都有，不描黑線），正面標籤是印刷紙（米色紙紋、紅色雙框加細黑線、上方紅色菱形家紋、下方深紅帶加金線，紅色印章在右下）；飯桶 `blender/ricetub.py` 的白飯是一粒粒畫出的米（畫在貼圖上；飯桶約 5,000、飯桶台約 3,700 個三角面）。
- 圓凳（`blender/stools.py`）：客人的吧台椅 `stool.glb`（矮胖的款：座面頂 29 公分、兩片橡木拼的圓座面像饅頭一樣圓邊、蓬鬆的藍色坐墊滾邊加釦子、四支粗腳外八到圓腳、一圈腳踏環；木紋照每個零件的方向：座面是攤平的平切紋、腳與環是順著長的直紋，`StoolOak`／`StoolOakLeg` 兩張貼圖）；收銀台後面兩張是自己的款（`blender/tillstools.py` → `tillstool.glb`，跟客人的圓凳不同）：胡桃木框、燈芯草編的方座面（四片三角、紋路順著各邊、在對角線交成 X）、方腳收細到黃銅腳套、前面腳踏上包黃銅；`TillStoolHigh` 是收銀員的椅子（44 公分，後腳往上延伸成靠背，彎的頂板下是淡色檜木組子：一片貼圖 `TillKumiko`，空隙用 alpha 切掉（BarFurnish 的 `alphaTest`），不是二十根小木條），`TillStoolLow` 是同款無靠背矮凳（34 公分）；面數約 490／330（方腳、橫撐不倒角，座面 4×4 格）；GuestBar3D 的 `Register` 裡（`TILL_CHAIR`），Movable `till-stool-hi`、`till-stool-lo`。**收銀員坐在高椅上**：椅子的 Movable 裡有一個看不見的記號 `cashier-seat`（座面高 `TILL_SEAT`），Roasting 的 `CrewWalk`（`seat`）每格照它的位置與朝向擺人（椅子被移動也跟著），`StaffFigure` 的 `seated`：身體微前傾、雙手放在櫃檯上、不時敲鍵；打烊時從椅子下來走出去。客人坐的高度 `FolkFigure.tsx` 的 `SEAT`（0.31，坐在壓下去一點的坐墊上）；舊客人（`?guests=old`）坐下時往下移 `OLD_STOOL_DROP`。每張約 2,500～3,000 個三角面。
- 竹簍（烤馬鈴薯、地瓜放的竹ざる）：`blender/zaru.py` → `zaru.glb`（Roasting 的 `Basket`）：竹條平織、一上一下交錯（每條竹子深淺不同、交叉處有起伏的法線貼圖），邊緣是藤條斜纏的粗圈；大小照 `BASKET_R`。
- 其他 Blender 模型：竹盆栽（`blender/barfurnish.py` → `bamboopot.glb`，`BarFurnish.tsx`）、廁所免治馬桶、洗手台與小配件（`blender/wc.py` → `toilet.glb`、`washstand.glb`、`wcbits.glb`）、大砧板（`blender/cutboard.py` → `cutboard.glb`，淡色檜木四片拼板，Roasting 的 `Tray`）、飯桶（`blender/ricetub.py` → `ricetub.glb`，節點 `RiceTubBody`／`RiceTubLid`／`RiceTubRice`，蓋子仍可點開）；飯桶台（`blender/ricestand.py` → `ricestand.glb`：檜木桌面加胡桃木邊框、雲形牙板、外撇的桌腳、竹條下層放碗）。
- 人物與食物的光影是柔和五階漸層（`Person3D.tsx`、`Dish.tsx` 的 `gradientMap`），人物另有手繪式由下往上的明暗與邊緣微光（`airbrush`），參考冷凍櫃上那條手繪藍魚的風格。

## 烤魚店的 3D 店面（`src/shops/grill/`）

| 檔案 | 內容 |
|---|---|
| `bar.ts` | 店面的共用資料與純計算（不含 React）：吧台 `GRILL_COUNTERS`（`shift` 座位位移、`far` 牆距）、座位 `seatsOf`、整間地板 `roomOf`、閘門 `BAR_GATES`/`gateOf`、收銀台 `TILL`、廁所 `toiletsOf`、飲料櫃 `fridgeOf`/`DRINKS`、玄關 `GENKAN`/`inGenkan`、盤子堆 `PLATE_STACKS`、醬油碟位置 `sauceSide`；以及兩邊溝通用的狀態 `SERVICE`（出餐口與外場）、`SEATS_TAKEN`、`PLATES_SET`、`TOILETS`、`POINTER_HINT` |
| `Roasting.tsx` | 爐火、料理台、吧台本體（`Bar`、`BarCounter`、`BarGate` 擺動門）、烤物的流程與點餐 |
| `GuestBar3D.tsx` | 客人（進出、坐下、上廁所、拿飲料、換拖鞋、淡出）、外場服務生（先到碗盤櫃拿盤子，再從閘門進出送餐）、盤子、地板、玄關、收銀台 `Register` |
| `DiningRoom.tsx` | 牆面與牆上的東西（畫、門口的神棚與供品 `Altar`、男女廁所與室內 `WcRoom`）、飲料櫃 `DrinkFridge`、場內擺設 `ShopProps`（酒樽、竹子、柳樹、酒箱） |
| `Decor.tsx` | 料理台上的擺設：炭箱、扇子、行燈、飯桶與作業台 |
| `Grill2D.tsx`、`Grill2DArt.tsx` | 手機（螢幕短邊 < 600px，平板不算）不用 3D：同樣的烤爐玩法畫成 2D（邏輯在 Grill2D，SVG 插圖在 Grill2DArt） |

- 客人的餐點送到的那一刻會開心地彈一下（蹲、拉長跳起、壓扁落下，約半秒，眼睛瞇成開心的弧線約 1 秒；`scene/Person3D.tsx` 的 `served`）；dev 時 `__guestStates` 看每位客人的狀態。
- 客人模型由 `blender/guests.py` 產生：表情（`eyesJoy`、`brows*`、`mouth*`，依評分切換，見 `scene/people.ts`）、走路動作（`Walk`／`WalkF` 女性／`WalkU` 大叔／`WalkO` 老人，速度也不同）、大學生的耳機 `student.phones`。臉型（圓、長、方、瓜子）是在 `scene/Person3D.tsx` 的 `shapeFace` 依 id 變形。
- 火爐是囲炉裏，遊戲裡沿桌長方向拉長 `HEARTH_LONG`（1.15，略長方形，置中對稱；Roasting 載入時把 `FirePit`、`Robuchi` 的 x 放大，`clearOfHearth` 也用它）；爐框朝火的內壁是燻黑、帶焦痕的另一個材質 `RobuchiBurnt`（`blender/grilledfish.py` 的 `IRORI_IN`／`IRORI_W`，改這兩個要同步 Roasting 的 `HEARTH_HALF`：直紋櫸木爐框 `Robuchi`、黃銅護角；石頭目前拿掉（`grilledfish.py` 的 `STONES = False`，改回 True 就恢復，會沿框內緊密圍一整圈）；竹籤（現在是鐵串，材質名仍叫 `BambooSkewer`，遊戲靠這個名字找串）沿一圈「方中帶圓」的環站立（`ring_at`：超橢圓，四邊是平行的一列、轉角漸漸轉向），每支沿環的法線往火斜；位置由 `settle_skewers` 一支支試出來：沿環往前挪，直到食物、竹籤都不碰到已經擺好的（網格 BVH 實測、竹籤算粗細），再把剩下的長度平均分掉。改了串的東西要跑 `blender -b blender/grilledfish.blend --python blender/clipcheck.py` 確認 0 組穿模；魚是爐端燒的樣子：頭朝下對著炭火、身體幾乎打直、背鰭一排鹽白的刺、胸鰭張開、尾巴撒滿化妝鹽、眼睛烤白、嘴巴張開；蝦是一隻大明蝦直串、頭朝下、觸鬚往火垂；爐框大小讓前排的盤、碗、砧板都在框外），遊戲裡轉到跟桌邊平行；東西不能放進爐框（Roasting 的 `clearOfHearth`，方形判斷）。刀具直立掛在缺口後面的桌身上（包丁差し，`blender/knives.py` → `knives.glb`，Decor 的 `KnifeSet`、`KNIFE_BOARD`，面向站在缺口裡的老闆；以前是橫放在一片大理石板上的刀架，店主要直立、不要那塊板、刀要精緻）：淡色檜木板（直紋），上緣一條胡桃木橫條架在兩塊墊木上、黃銅螺絲，刀從橫條與板之間的縫掛下去，刀箍靠在橫條上、柄朝上、刀身朝下貼著板、刃一律朝左、正面（有斜面那面）朝老闆，由長到短：柳刃 270、牛刀 210（大馬士革花紋、黑檀柄、白水牛角箍加一圈鎳墊片）、薄刃 180、出刃 165；單刃的刀照實際的研法：背面平、正面從鎬線（明亮的一條線）往刃磨出斜面，斜面上霧面的軟鐵與刃口一條亮的鋼、中間的界線起伏，往刀尖漸薄；每把在刀根下方刻「正本」兩字（`GLYPHS`，筆畫是細長片）；柄是八角朴木、黑水牛角箍，稜角倒圓。遊戲裡刀身、墊片、螺絲是真金屬並反射攝影棚環境（`KNIFE_METAL`、`reflectStudio`），看得到鋼的亮光；約 4,000 個三角面，大砧板是淡色檜木拼板（`blender/cutboard.py`，Roasting 的 `Tray`）。
- **灶台的擺放**（依使用者的箭頭）：調味料全部站在掛在爐框正前方的調味架上（`grilledfish.py` 的 `SeasoningBox`：杉木層板＋前緣擋條＋兩個支架，`LEDGE_L` 1.62，九種調味一排、刷子湯匙柄朝廚師、各自往左或右靠在罐口（`SIDE`），各有各的長短（`REACH`：柄從頭往上多高、往外斜多少；醬油刷最長、站在深罐裡，煉乳刷次之，味噌木鏟中等，花生木匙、七味竹匙、柚子胡椒鋼匙短、斜靠在口緣，山葵小瓷匙最短、幾乎橫躺在淺碟上；以前全部一樣高，像一排筷子）；每個罐子是拉坯的車削體（`open_pot` → `lathe`、`pot_section`：高台、圓腹、捲邊口緣、有厚度的內壁），釉色各自畫成一張貼圖（`glaze_picture`，`GLAZES`：鹽與味噌是瑠璃釉、醬油與柚子胡椒是天目釉（口緣轉鏽色、兔毫紋）、煉乳是志野白釉（火色斑、針孔）、山葵與檸檬小碟是染付（口緣一圈鈷藍線、碟心兩圈）、花生粉與七味是車木碗（年輪）；釉從口緣流下的垂釉、底部露胎的高台）；罐裡的東西是從上方貼圖的小丘或液面（`filling` 的 `kind`、`fill_picture`：鹽的結晶、醬油與煉乳的反光、七味的芝麻與山椒粒…）；罐子內側是另一個材質 `PotInside…`、罐中物是 `Fill…`，遊戲不描線（`scene/Dish.tsx` 的 `NO_OUTLINE_MATERIALS`），不然內壁的描線會在罐中物上畫出一道黑弧；模型在遊戲裡是轉半圈的，所以 `tang`、`out` 是反的），正對廚師站的缺口（Roasting 的 `BOX_SPOT`），固定不動（`FIXED`：不被推、也不推別的東西）；團扇掛在調味架左端的竹鉤上（`FanHook`，跟著調味架移動；Decor 的 `Fan` 用 `fanAt`、`FAN_HUNG` 朝向廚師，拿起來搧完會掛回去）；行燈在後方偏左（`DECOR.lantern`，原本在角落會插進吧台擋板）；垃圾桶在右側、水桶前面；飯糰小碟在右前方（原調味盒的位置）。
- 備長炭（`blender/binchotan.py` → `binchotan.glb`，`shops/grill/binchotanModel.ts` 的 `useBinchotan`）：六根炭、六種碎塊、六種灰渣（`BinAsh`，灰色顆粒、底部平的），炭用卡通（toon）材質（炭面、凹凸、龜裂發光貼圖）。炭箱、手上拿的、火裡的都用它，丟進火裡外觀不變，隨溫度亮起龜裂紋；燒到 95% 會斷成 3～5 塊往下掉，變成灰（`game/coalPile.ts` 的 `crumble`，BDD `coal-pile`）。放進火裡的炭是**立著的**，像爐端燒的炭火（`standStick`）：一圈圈圍著火（`STAND_RINGS`，由內往外填，相鄰圈錯開），每根腳踩在鹽床上、往中間靠（頂端收到腳的 6 成），像圓錐形堆的柴，火焰從中間竄出來（App 的 `Fire` 從鹽床表面起、0.75 高）；鹽床高度 `surfaceY` 依模型實測（改了鹽床要重量）。**添炭只能從炭箱拖一根炭到火上**（點火堆沒有作用；只有炭能 hover，籃子不行），一次一根（`STICK_COST`、`STICK_BOOST`，BDD `fire`），炭箱少一根（`Decor.tsx` 的 `CRATE`、`takeFromCrate`，拿完換一箱）。火力條的按鈕與 AI 主廚仍是一次一份（6～7 根，`COAL_PER_ADD`）。
- 水桶與水瓢在 `blender/grilledfish.py`（`WaterBucket`、`WaterDipper`、`DipperWater`）：杉木桶板、竹箍。指到整個水桶就是拿水瓢：先舀水（水瓢沉進桶裡再提起，杯裡有水），放開就倒水（傾倒、水流），倒在食物上是灑水、倒在炭上是澆熄。
- 神棚（`blender/kamidana.py` → `kamidana.glb`，`DiningRoom.tsx` 的 `KamidanaModel`）：三社造的檜木神棚，金屬配件（千木、鰹木的金頭、屋脊、門上的金紋、擬寶珠、台階金片）用真金屬材質並反射 `scene/studio.ts` 的攝影棚環境（金屬靠反射才看得出是金屬，店內光暗也照樣亮）；橘子盤 `KamiOranges`、經本 `KamiSutra` 也在同一個檔裡。倒酒時杯中酒面依杯子內壁的半徑長高（`cupInnerR`），不會穿出杯子。
- **廁所的門**（`blender/wcdoor.py` → `wcdoor.glb`，DiningRoom 的 `useWcDoor`）：和式腰高障子拉門，杉木框（直紋順著每根料）、下半是平切杉木板（山形紋一次鋪滿整片）、上半是細密橫繁組子貼和紙、自由端有小黃銅牌（遊戲在上面畫「使用中／空き」，`LockWindow`）與嵌入的橢圓引手；門框是深色杉木（`WcDoorFrame`）。兩扇門各複製一份（各自滑開）。
- **廁所**（`shops/grill/Restroom.tsx`，規則在 `game/restroom.ts`，BDD `restroom`）：每間有清潔度與衛生紙（`TOILETS[who].room`）；客人用一次變髒一點、用掉一捲的 1/5，髒（`DIRTY_AT`）或沒紙時會抱怨，之後吃的東西評分扣分（`WC_GRUMBLE`，Roasting 讀）；開店前店員會打掃，衛生紙不會自己補。點馬桶：不乾淨就用馬桶刷打掃（刷子從角落的筒子飛過去刷、刷完發亮），乾淨就沖水（水漩下去、水箱上的洗手龍頭流水）；點衛生紙架換新捲（捲越用越細，新捲的紙頭摺成三角）；牆上有免治遙控器（點一下溫水噴一下）、沖水鈕、音姬（流水與鳥叫，女廁有人進去會自己播）。一間一次只進一位（有人在去、在裡面、在出來時，下一位等）；有人在裡面時門關著、門上小窗顯示「使用中」，點門會敲門；沒人時「空き」。進門時馬桶蓋自動掀起，燈是感應式（有人或門開才亮）；髒了地上有污漬、馬桶裡有黃圈，很髒有蒼蠅。聲音都是 WebAudio 即時合成（`restroomSound.ts`）。
- **供花**（神棚兩側花瓶，點一下換花，存在 localStorage `jgs-shrine-flowers-1`）：三組花各有加持（`game/shrineFlowers.ts`，BDD `shrine-flowers`；模型都是 `blender/shrinevase.py`，第三個參數是變體：2 榊與小菊 → `shrinevase.glb`、0、1；每根莖都是柔和的曲線：從水裡近乎直立長出、往外傾、從花底下接到花，莖與霞草細枝的曲線解析度壓低，不會暴增面數）：榊與小菊＝平安（客人耐心較長）、白金菊（`shrinevase.py` 變體 0：輪菊、糸菊、小菊）＝金運（更常拿飲料）、紅粉花（變體 1：芍藥、紅椿、桔梗、霞草）＝良緣（情侶較常來）；兩瓶同一種加倍。神棚門聲（`shrineSound.ts`）是黏滑摩擦合成的吱呀聲＋檜木共鳴＋門扣與門片碰撞聲。
- **炭火的聲音**（`shops/grill/fireAmbience.ts`，WebAudio 即時合成）：炭的劈啪聲隨火力、烤物的滋滋聲隨火上的數量（`game/fireSound.ts`，BDD `fire-sound`）；鏡頭離火越遠越小聲；營業時另有客人的人聲（`crowdAmbience`，隨在座人數 `murmur`）；玩家第一次點擊後才開始（瀏覽器規定）。
- 太陽光（App 的 directionalLight）會投影，影子涵蓋整間店；陰影圖每 3 格重畫一次（`ShadowPacer`）；只有夠大的東西會投影（包圍球半徑 ≥ `CASTER_R` 0.3，`ShadowPacer` 每 1.5 秒把新出現的小網格設成不投影：盤子、瓶子、杯子這類小東西不進陰影圖）。
- **門口那一側的牆邊**（店主指定的位置）：神龕的層板（DiningRoom 的 `shelfZ`；供桌比模型淺：`TABLE_DEEP`，0.58 → 0.53，後緣仍貼牆，琉璃台、酒壺（`FLASK_X`）往後 0.02、橘子盤往後並縮到 0.76、經書往後一點，都在桌緣內）、它下面的招財貓台（GuestBar3D 的 `CAT_STAND_Z`，站在玄關台階外的木地板上）、玄關石地上的鞋櫃與上面的頭盔（`SHOE_CAB_Z`，一端靠著台階）都往裡移，門口與收銀台那端空出來。
- **門口的燈籠**（`blender/genkan.py` 的 `lantern()` → `chochin.glb`：長提灯，62 公分高、近乎圓筒、中間微鼓，黑漆上下蓋加金帶；竹骨與明暗畫在貼圖上，不做成網格，約 2,600 面）：門簾兩側各一個（GuestBar3D 的 `Chochin`，`style`）：一個紅的（店的字「燒」，黑字金邊，Movable `chochin`），一個米白的燒烤燈籠（「炭火焼」黑字，上下紅帶，Movable `chochin2`）；貼圖 `chochinTexture(mark, style)` 一圈畫兩面字。注意：`genkan.py` 也會重出 `noren.glb`，門簾沒改時要還原它。
- **門簾**：入口的是米白棉布、深褐菱形家紋（中間「聞」）與一行 KIKUNO · YAKIZAKANA（`GuestBar3D.tsx` 的 `crestNorenTexture`，左右翻轉畫，從店內讀起來是正的），原木橫桿（`NorenModel` 的 `pole="wood"`，沒有吊線），寬同門口、加長 `NOREN_BIG`。沒有員工出入口：打烊後（`SHOP.leaving`）員工都從正門走（`bar.ts` 的 `staffWayOut`：第一座吧台靠收銀台的閘門 → 走道 → 正門）；廚房的人先從灶台桌尾端與飯桶之間繞出來（Roasting 的 `crewWayOut`，二廚、主廚先沿桌前走），收銀員沿收銀台後方走到閘門，外場從自己的閘門出來（側吧台的繞過轉角）。
- 場景外的背景是深灰 `#26262c`（CSS 變數 `--scene-bg`，開發者面板「背景色」可改，存 localStorage `jgs-scene-bg`，`edit.ts` 的 `setBackdrop`），白天晚上一樣，中心較亮往外變暗的放射漸層（`index.css` 的 `.canvas-layer`），畫面四周有暗角（`.canvas-layer::after`，夜晚較深）；整間店底下有一片柔和的落地陰影（GuestBar3D 的 `GROUND_SHADOW`）。吊燈、燈串的光暈與桌面光圈白天淡、夜晚亮且多一圈大光暈（DiningRoom 的 `nightGlow`，跟著 data-theme）。白天圓窗（`RoundWindow`）的窗紙是天空的淡藍（和紙的纖維，沒有竹影：店主說不要），木作是 `blender/roundwindow.py` → `roundwindow.glb`（DiningRoom 的 `RoundWood`）：櫸木窗框車成線腳（內緣壓住窗洞的唇、倒角、寬的正面、外緣圓角到牆），四段彎木拼成、每段色調與木紋不同、接縫一條細線，木紋順著圓走；內圈一條深色細圓邊；窗洞內襯木紋繞圈；三橫三直的杉木格子，倒角、木紋順著每根；繞一圈做的面要注意朝向（`revolve` 的繞法：輪廓從內往外畫，面朝房間與外側，曾經整圈朝內，遊戲裡被剔掉、只看到描線變成黑圈），窗框外一圈冷光（`WINDOW_HALO`，中間透明，不蓋掉窗紙），還有一道藍白的光斜斜照進店裡（`SUNBEAM`，兩片交叉的漸層面）；晚上都沒有。
- 開店（載入）時的起始視角是 1 自由視角（總覽，App 的 `view` 初始值 `free`），和從選單選「自由視角」完全一樣（調過的攝影機還沒擺好前先等它，App 的 `camTry`）；e2e 會先切到 2 火烤灶台再補貨。
- 把飲料從飲料櫃拖到老闆附近（3 以內）的桌上放下，老闆會走過去拿起來喝、說一句話（`Boss.tsx` 的 `BOSS_DRINK`，台詞 `data/bossLines.ts` 的 `DRINK_LINES`；dev 時 `__bossDrink`）。
- 供清酒（點門口神棚前的酒瓶）：60 秒內來客變多、每人點得較多（`App.tsx` 的 `lightIncense`、Roasting 的 `blessed`；名稱沿用舊的點香）。
- 招牌字：`scene/signFont.ts`（Zen Antique，字體載入後貼圖會重畫；新增招牌用到的字要同步加到 index.html 的字體請求）。
- **擋住視線的吊掛物會變淡**：`scene/OccluderFade.tsx` 每幾格從鏡頭朝看的目標（`__ctl.target` 在畫面上的位置，周圍一圈）打射線，標了 `userData.fade` 的群組（門簾、紅燈籠、旗幟串、幟旗、燈串、吊燈）擋在中間就淡到 18%，移開就恢復（各自複製材質，不影響共用同一材質的東西）。新的吊掛擺設要會變淡，就在它的群組加 `userData={{ fade: true }}`。淡化時用的是材質複本，每格跟著原材質同步（顏色、貼圖：電燈開關讓燈罩變暗也跟著變），恢復後換回原材質（以前會一直留著複本，關燈後被淡化過的燈籠還亮著）。
- **收銀抽屜的錢**（`game/till.ts` 的 `openingFloat`／`deposit`／`takeOut`，BDD `till`）：付現的客人把帳單放進抽屜；抽屜開著時老闆點紙鈔格或硬幣格把整格拿走，加進現金（帳本的「收銀機取款」，`ledger.till`）。
- **飲料後場庫存**（`game/drinkStock.ts`，BDD `drink-stock`）：**新開的店飲料櫃是空的**（`emptyFridge`），要自己從後場補；後場（飲料櫃旁的紅色酒箱與一疊印著飲料的紙箱 `blender/drinkcartons.py` → `drinkcartons.glb`，罐裝的五種：ビール、お茶、コーラ、ハイボール、チューハイ，印刷由遊戲畫 `cartonPrint`；`bar.ts` 的 `DRINK_BACK`，開始各兩箱）。點酒箱或紙箱打開**飲料庫存**（`shops/grill/DrinkStockPanel.tsx`，樣子照食材櫃：飲料、酒類兩區，每種飲料顯示櫃中幾瓶／幾個位置、後場幾瓶、一箱幾瓶，按鈕「訂一箱」（從現金扣進價 `SHOP_PURSE`，記在帳本的採買）與「補」（從後場補進櫃，`fillFromBack`）；下方「全部補滿（從後場）」「缺的各訂一箱」；Esc 或 × 關）。雇了倉儲時，店員（GuestBar3D 的 `Stocker`）在櫃裡缺 3 格以上時也會自己搬（一趟最多 `STOCK_CARRY`）。櫃子與後場存在 localStorage `jgs-drinks-1`（`readDrinks`／`writeDrinks`，櫃子的形狀不合就當新店；「重新開始遊戲」會清掉）。
- 飲料櫃每格是前排加後面一排（`RANK_DEPTH`，每台約 80 瓶；瓶子 16 段車削；前排與後排合併成一批 `StaticBatch`，每格一個看不見的感應方塊給滑鼠指，指到的瓶子周圍亮一圈 `BOTTLE_HALO`，拿起來的那瓶單獨畫）；拿出冰箱的飲料（地上、桌上、客人面前、手上）有凝結水珠（`DrinkBottle` 的 `wet`，櫃內的沒有）。
- **碗盤櫃**站在一個矮收納櫃上（`blender/platecabinet.py` → `platecabinet.glb`，`PlateRack.tsx` 的 `CabinetBase`，高 `CAB` 0.7：上面兩個抽屜、下面一對引き違い拉門，杉木紋，門板是平切山形紋），整座放大（Decor 的 `baseScale` 1.12）。
- **吧台的桌上擺設**（`blender/barsetting.py` → `barsetting.glb`，Roasting 的 `BarPiece`、`SETTING`，照實際比例，吧台單位約 1 公尺）：每個座位客人面前橫放一雙塗箸（黑漆上段＋金線、深紅下段，22 公分），筷尖朝客人的左手邊擱在靛藍釉的筷架上；盤子放中間（GuestBar3D）；醬油碟（9 公分、高台、花色用盤子的 `wareDesign`）在盤子後方原位（GuestBar3D 倒醬油的位置）；胡桃木面紙盒（24×12×7.5 公分）在每兩個座位之間、靠擋板，出餐口托盤那格不放。吧台面的深色芯降到板子裡（以前凸出 4 公釐，整片褐色蓋在桌面上）。吧台底座是深色杉木立板（`panelBox`＋`COOK_PANEL_WOOD`，帶一點自發光，不然在桌面陰影裡全黑），槽燈的光暈用加法疊上去，離底座 7 公釐（以前貼太近會閃）。
- **出餐口（`bar.ts` 的 `passOf`、`PASS_ALONG`）**：第一座吧台檯面上、廚房那半邊、第一和第二個座位之間（不會擺在客人面前像是他的）；一個黑漆紅底的托盤（`blender/passtray.py` → `passtray.glb`：圓角、外撇的矮邊、金色描邊的唇口、兩條墊腳；Roasting 的 `PassTray`），做好的菜橫放在盤上一排 6 份（`passSpot`），服務生站在對面走道拿（GuestBar3D 的 `passSpot`）。**做好卻沒人要的菜**（客人等太久走掉了）：主廚每一步先看有沒有別的客人也點了同樣的菜，有就直接給他（`serveTo`，說 `orphanAgain`）；沒有就放 `ORPHAN_WAIT`（20 秒）後撤下丟進垃圾桶（`orphanAway`）。以前這些菜一直留在灶台的盤子上或出餐口，開越久桌面越亂。
- **碗盤統一放在碗盤櫃**（`game/plates.ts`，BDD `plates`；店主定的：灶台桌、灶台櫃裡都不放盤子，只有試吃碗公）：兩組矮的碗盤架並排（`PlateRack` 的 `part` 0／1，Movable `platerack`、`platerack2`），每組下面一個矮櫃（`blender/platecabinet.py`，1.0 寬、0.56 高），架上 25 個（`PER_RACK`：下層插盤架 11、上層兩疊各 7），合計 50 個（`RACK_FULL`，店裡全部的盤子）；第一組顯示前 25 個、第二組顯示其餘（第二組先空）；架上顯示幾個就是幾個（`bar.ts` 的 `PLATE_RACK.n`）；碗盤架不能點。**上菜**：客人的第一份菜要盤子時，外場先走到碗盤櫃前（`rack-front-<part>`）拿一個（`takePlate`，盤子從 `rack-top-<part>` 升到托盤上），再穿過廚房回到自己的閘門、出去出餐口拿菜、送到座位（GuestBar3D 服務生的 `plate`、`grab` 階段）；沒有外場時盤子直接從碗盤櫃飛過去。碗盤櫃空了客人就等，洗好一個馬上補上。**廚房裡的路線**：`game/kitchenPath.ts`（BDD 同上）：廚房地板畫成格子用 A* 找路、再把能直走的拉直；擋路的是灶台（Roasting 的 `cook-table-c0`、`c1` 兩角）、飯桶、冷凍櫃、碗盤架、流理台，依模型頂點在第一座吧台的座標算出佔地、再留 `PASS_ROOM` 給人走（`kitchenBlocks`，每天開店算一次）；起點或終點落在留的空間裡時先往最近的邊走出去。**洗碗**：吃完的盤子飛到**流理台**（`blender/sink.py` → `sink.glb`，`Sink.tsx` 的 `SinkModel`，Movable `sink`，在後牆冷凍櫃旁（Decor 的 `SINK_AT`）：不鏽鋼業務用水槽、鵝頸水龍頭與冷熱把手、瀝水架上立著盤子、海綿、洗碗精），在水槽裡疊起來（`SinkBasinFloor`，縮到 `IN_SINK` 0.78：遊戲的盤子比水槽寬）；累積 `WASH_AT`（5）個、或碗盤櫃空了就開始洗（`washNow`）：水龍頭流水（`SINK.washing`），每 `WASH_EACH` 秒洗好一個，從水槽升起飛回碗盤櫃（`putBack`）。打烊時所有盤子歸位（`RACK_FULL`）。dev 時 `__plates`、`__sink`、`__waiters`、`__dirty` 看狀態。
- **自動營運的營業套路**（`game/flow.ts`，BDD `flow`）：每次開店抽一種（平日、午餐尖峰、晚餐尖峰、雨天、祭典、觀光團、熟客日），各自的來客節奏、結伴比例、點單量不同，開店時主廚會說。
- **身高**：老闆（`BOSS_SCALE`）約 1.83 高，廚師與店員（Roasting 的 `CHEF_SCALE`、GuestBar3D 的 `STAFF_SCALE`）縮到跟老闆一樣；客人仍是原尺寸（吧台、椅子照他們做）。廚房地板是比客席高一階的高台（`bar.ts` 的 `KITCHEN_DROP` 為負 = 高台，GuestBar3D 的 `KitchenDais`：閘門與末端各一階踏板；服務生走上高台時跟著升高），灶台桌面約在老闆腰部；桌下櫃子的層板 `CUBBY_SHELF_Y` 跟著地板。
- **底座**（GuestBar3D 的 `ShopBase`）：地板下一路實心到底座（`RoomFloorImpl` 的填充，高 `baseDrop`；廚房是高台或下沉都會填，高台時連廚房底下也填），地板邊緣看不到空隙；底座三層（淺色邊板、深色本體、踢腳）。
- 店面沿吧台縮短了 `BAR_TRIM`（`bar.ts`）；玄關 `GENKAN.along` 往吧台拉長。
- **效能（改東西時要守的）**：
  - **執行中新建的 GPU 資源一定要釋放或共用**（three.js 不會自己回收：沒 `dispose()` 的幾何體連同頂點緩衝、VAO 一直留在 GPU）：會一直出現又消失的元件（`WhenHeld` 裡的盤子、碗，每道菜的蒸氣，收銀抽屜的硬幣堆，每位客人）不要在 `useMemo` 裡各自建幾何體：改用模組層級共用（Roasting 的 `wareOnce`），或在 `useEffect` 的清理裡 `dispose()`（`Steam`、`CoinPile`、`FolkFigure` 釋放客人自己的材質與臉部貼圖複本，但不動共用的描邊材質）；同種東西的材質做一次共用（Cash 的 `noteMats`、`coinMats`）；炭的碎塊形狀以 2 公分分級快取（`binchotanModel` 的 `chunk`）。檢查工具：`tests/e2e/_leakfind.mjs`（開店後記錄每個貼圖、幾何體、材質是誰建的，幾分鐘後列出「沒釋放又不在場景裡」且還在增加的，依建立位置分組；在 git 外，複製一份即可用）。
  - **3D 畫面中斷（WebGL context lost）**：顯示卡記憶體不夠或驅動重設時，瀏覽器會收回 3D 畫面。App 的 `webglcontextlost` 先把當下的進度（錢與帳本、庫存、員工與應徵者名單、研發筆記、菜單、日夜、語言）存進這個分頁的 `sessionStorage`（`jgs-resume-1`，`game/resume.ts` 的 `keptForResume`，BDD `resume`），4 秒內沒拿回畫面就自動重新載入，載入時 `resumeFrom` 讀回一次就刪掉（十分鐘內有效）；一般重新整理照舊從頭開始。**會讓顯示卡資源越積越多的寫法要避免**：元件被重新掛上時（`key` 換了）`useMemo` 會重建模型、貼圖、描線，舊的不會自己釋放：以前酒樽、柳樹、竹盆栽、酒箱的 `StaticBatch` 用語言當 `key`（為了早就拿掉的地墊），每切一次語言整組重建；環境光（`IndoorHDRI`）每切一次日夜重做一次，three 為它模糊的那張留在顯示卡上。現在日、夜兩個環境各做一次一直留著，只換場景用哪一個。檢查：`tests/e2e/_toggleleak.mjs`、`_themecount.mjs`（在 git 外）。開發伺服器的熱更新也會在已開著的分頁裡累積資源：改了很多次之後重新整理一下再玩。
  - **營業時食物模型要回收**：每點一份，`Dish` 就複製一份食物模型（`addCopy`），吃完只是藏起來（`present` 看的是 `copy < 數量`，營業的點單數只增不減）；以前整天下來越堆越多，每格都要算、矩陣都要更新，玩久了越來越卡。現在新點單先找同一種已吃完、清掉的那份（Roasting 的 `recyclable`），重設後當新的上砧板（`revive`），App 的點單只收錢扣庫存、不增加數量（`onOrder(id, guest, reuse)`、`onOrderEntry(key, guest, reuse)`）；模型數停在同時在用的份量。
  - **不要用 transmission（透光）材質**：場景裡只要有一個，three.js 就會每一格把整個房間先畫進一張圖再畫一次（曾經一顆冷凍櫃燈泡就多了 2,500 次繪製，畫面從 60 掉到 19）。玻璃感用 clearcoat、反光點、透明度做。
  - drei 的 `<Environment>`（`IndoorHDRI`）要 `memo`：它的 children 一換就重算整個環境貼圖（6 個方向畫一次房間＋60 次模糊），開店時上層一秒重畫很多次。同理，不常變的大場景元件（`ShopProps`、`DiningWall`、`Decor`、`Bar`、`CookTable`、`BarCounter`、`BarGate`、`DiningFloor`、`RoomFloor`）都包了 `memo`；新加的、會被常重畫的父層包住的大元件也要包。
  - 用 `StaticBatch` 或 `mergeByMaterial(root, keep)`（`scene/StaticBatch.tsx`）把不會動的零件依材質合併成少數幾次繪製；`keep` 留下自己會動的部分（手、眼、嘴、蓋子、按鍵、抽屜、螢幕…）。模型的材質要依來源材質共用一份（用 Map），不然每個零件一個材質就合併不起來。合併後的網格不能被指到：要能點的東西放一個 `visible={false}` 的感應方塊（r3f 的射線不管 visible），例如飲料櫃的瓶子、炭籃的炭、碗盤櫃。`StaticBatch` 藏起來的原物件不再每格更新矩陣。
  - **常被重畫的父層底下，重的子元件一定要 memo**：開店時 App 每秒重畫約 2～4 次（說話氣泡、帳本、員工疲勞、聊天）、`GuestBar3D` 與 `Roasting` 約 5～6 次（多半是 App 重畫時傳下來的新 props），子元件跟著重畫（`tests/e2e/redraws.mjs` 量，以前 App 6 次、吧台與灶台 7 次）。以前飲料櫃每秒重畫一千多支瓶子、`Movable` 每秒六百多次，開店時每秒製造 126 MB 垃圾（`alloc.mjs`）；現在 `DrinkFridge`／`FridgeStock`／`FridgeDoor`／`DrinkBottle`、`Entrance`、`Register`、`Stools`、`Fridges`、`Stocker`、`PersonClock`（傳 `phase`、`drink`、`eating`、`mood` 讓它知道何時要重畫，不傳整個客人物件）、`FoodArt`、`FishSign`、`ViewCams`（姿勢經 ref 讀最新的）、`EditProxy`、`BossSpot`、`BlobShadow`、`MoodFace`（比 rating 與 state）、吧台的 `Plate`、`StaffFigure`、`Steam`、菜單的 `StripArt`、灶台上的出餐盤、砧板、試吃碗、竹簍、垃圾桶、炭床、小碟都 memo，開店時每秒 0 次 `Movable` 重畫。傳給 memo 元件的 props 要穩定：陣列用 `useMemo`（`fridgeClear`），物件裡的 callback 用 ref 轉呼叫（App 的 `incenseProp`），向量用 `equals` 比較；位置每次都是新的 `[x, y, z]` 時用 `scene/sameProps.ts` 的 `sameProps`（陣列比數字）。**每位客人頭上的名牌**（drei 的 `Html`）各自是一個獨立的 React DOM 根，父層一重畫就整個重排：拆成 `GuestLabel`（GuestBar3D），只在說的話、等待的點點、表情、名字變時才重畫（以前吧台每重畫一次，十個名牌各重排一次，每秒四十幾次）。**狀態更新沒變就回傳原物件**（`setShown` 沒人進出時回傳 `cur`，`setMoving` 同值不換陣列），React 才不會重畫。灶台的烤物進度標籤（`tags`）只在看得到時（研製）才算，營業時不算（以前每塊烤物每過一階就整個灶台重畫，每秒五六次）。App 的員工疲勞與薪資在同一個每秒的計時器裡更新（一次重畫，不是兩次）。
  - **離開的客人要準時從清單移除**：吧台每格把走出門的客人放進 `done`，再 `setShown` 濾掉；更新函式是之後才跑的，要先把那份名單存成常數（`gone`）：以前直接讀 `done`，等 React 跑更新時它已經被換成新的空陣列，什麼都沒濾掉，走掉的客人一直留在清單上（量到最久 22 秒），佔著座位號碼、每格都要求移除、吧台每格重畫。
  - **透明又雙面的材質一律單次繪製**（App 的 `ShadowPacer` 每 1.5 秒掃一次設 `forceSinglePass`）：three 會把它們畫兩次（背面、正面），每次之前都設 `needsUpdate`，每格為每個這種材質重算一次著色程式的參數（旗幟、光暈、玻璃、火爐邊緣，每格四十幾次）。這裡都是布、光暈、玻璃片，一次畫看起來一樣。
  - **每格跑的迴圈不要 new 東西**：`alongPath` 只為最後那段建向量；玄關台階的位置每條路線只找一次（`stepAt` 的 `WeakMap`，以前每位走動的客人每格沿路試走一百步）；群組變換用模組層的暫存矩陣（`Movable.tsx` 的 `GT`）。剩下的配置大多是 three 呼叫 GL 時的（每次繪製上傳矩陣），隨繪製次數。
  - **開店時的繪製次數**（`perf.mjs` 的 `OPEN=60000 BY=1` 依擺設列出）：2,283 → 約 2,100 次／格（renderer 每格 CPU 約 16 ms，正是瓶頸：每次繪製約 7 µs）。已合併：吧台閘門的門扇（框、板、縫、鉸鏈約四十件 → 幾個，跟著門一起轉）、冷凍櫃溫控旋鈕的帽與十六條紋、冷凍櫃裡的貨（`FreezerGoods`，蓋子掀起才畫）、飲料櫃頂的招牌（箱、板、二十一顆燈泡）與槽燈、廁所牆上的遙控器（29 → 14）、音姬（29 → 7）、紙架、刷筒、垃圾桶（`Restroom.tsx` 的 `useBits` 用 `mergeByMaterial`，合併後仍可指、可發亮）。兩座免治馬桶本體也依材質合併（`ToiletLive`，留下會動的蓋子、水、噴嘴）。吧台閘門門柱側的鉸鏈（鉸鏈管、片、螺絲、描線，兩扇共 32 次 → 8）、灶台櫃門的四根框條（每扇 4 → 1）、廚餘桶裡的垃圾（最多 24 件 → 1：依丟進去的順序合成一個網格、顏色寫在頂點上，用 `drawRange` 畫出目前有幾件）。收銀機的七十個按鍵平常畫一份依材質合併的複本（`cashRegister.tsx` 的 `keysAll`），有鍵按下或滑鼠指著時才換回各自的按鍵（一直可以指）：櫃檯視角 805 → 414 次。抽屜裡的東西（托盤、隔板、硬幣卷、紙鈔滾輪與壓板，三十五件連描線）只在抽屜拉出一點以上時才畫（`regModel.inner`，關著時全在機身裡看不到）。還大的：客人每位約 17 次；店員改成頂點顏色後每位約 17～22 次（以前 35～70）。
  - 正式版開店、全員到齊、×2 跑 23 分鐘（`soak.mjs`）：回收後 JS heap 88→95 MB、array buffer（幾何資料）225→241 MB，前十幾分鐘慢慢上升後持平；GPU 幾何 2105→2511、貼圖 358→376 也是先升後平：客人的造型樣板（`FolkFigure` 的 `templates`，髮型＋配件的組合，最多約 35 種）與炭塊的形狀（`binchotanModel` 依 2 公分分級）都是有上限的快取，第一次出現才建。DOM 約 900～980 個元素不變。
  - 目前（Intel Arc B580，1920×1080，最高畫質）：閉店總覽約 1,700 次繪製、60 fps；火烤灶台 840 次、60 fps；開店總覽約 1,800～1,900 次（6～8 位客人）、約 55 fps、renderer 每格約 14 ms（dev 模式；以前約 2,100 次、47 fps、16 ms）。
- 桌機（非觸控）一律最高畫質（`scene/quality.ts`），只有手機才判斷降級；卡頓時 `scene/FramePacer.tsx` 會自動降解析度，再不行就鎖 30fps（載入後 10 秒才開始判斷、看一段時間裡中位數的那一格，偶爾的頓一下不算；降到 1 倍解析度後會一直維持；網址加 `?pace=0` 就不會降）；右上角一排圓鈕（由左到右：經營（店面小圖）、自動營運（自，亮燈＝開）、×2 遊戲倍速、開店／閉店、語言、日夜；窄於 900px 時經營與自動營運仍是左上的長鈕），現金單獨顯示在這一排的最左邊（`money-chip`，研製時在冷藏櫃小圖示左邊（App 的 `has-fridge`），點一下開帳簿）；右邊的面板（食材櫃、經營、飲料庫存）都停靠在畫面右側同一個位置，旁邊直立大字標題（食材／經營 OFFICE／飲料 DRINKS，`.dock-title`），一次只開一個（開一個就關掉其他的，App 的三個 effect）；×2 是遊戲倍速（`scene/speed.ts` 的 `GAME_SPEED`：3D 時鐘由 FramePacer 手動推進，App 的計時器也乘上它）。

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
