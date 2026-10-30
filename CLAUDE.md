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
| `npm run e2e` | 瀏覽器實際玩一遍（需先開 dev server，約 4 分鐘）。`node tests/e2e/flow.mjs <url> grilledfish` 只測一間；沒有 Chrome 時 `CHROME_PATH=<chromium 路徑>`；軟體 GL 很慢時 `OPEN_FOR=240000`（營業等待毫秒，預設 40000） |
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

- 介面是 Blender 風格的深灰面板：左邊工具列，熱鍵照 Maya（選取 Q、位移 W、旋轉 E、縮放 R；同一個鍵再按一次切換世界／物件座標；4 線框看拓撲、5 回到著色），選到物件時面板顯示它的三角面、頂點、網格數；F 對準選取、A 看全部、Esc 取消選取；視角照 Maya：Alt＋左鍵旋轉、Alt＋中鍵平移、Alt＋右鍵推拉，不按 Alt 拖曳不會動到鏡頭；移動把手中間的橘色小方框可在面向鏡頭的平面上自由移動（三軸一起）；進出開發者模式鏡頭不動（選單收起不會改構圖）；面板下方列出熱鍵；清單可搜尋，變換區的 X／Y／Z 是紅綠藍色條。位置、移動箭頭、旋轉環、縮放把手都用**房間軸**（吧台方向 `ALONG`），不是各物件父層的軸。
- 每件能動的擺設用 `<Movable id label>` 包起來（裡面放自己的 `<StaticBatch>`；Movable 不能放在別的 StaticBatch 裡面）。開發者模式每件物件有一個貼合模型的細線框（`Movable.tsx` 的 `useEditBox`：量模型的頂點，順著物件的斜度找最貼的角度）：平常淡藍、只在沒被擋住處顯示；滑鼠移上去變亮、選到變橘色，這兩種會穿透顯示。點選的是物件本身的網格，所以大物件不會擋住前面的小物件。位置框（量出的範圍）仍用來放箭頭和算中心。
- **預設值**：位置預設寫在 `edit.ts` 的 `BASES`（父層單位）；大小與轉向預設用 `<Movable baseScale baseTurn>`。定好預設後面板歸零（位置 0、縮放 1）。改了預設要把 `edit.ts` 開頭的三個 localStorage key 版本加一，不然瀏覽器裡舊的偏移會重複計算。有預設轉向或縮放的擺設（例如備長炭籃、行燈），量到中心點之前先不顯示，避免載入時閃一下。
- **編輯介面中日文**：文字在 `data/editText.ts`（`EDIT_TEXT` 中、日各一份，`pieceName` 把擺設名稱翻成日文）；App 用 `setEditLang` 跟著遊戲語言切換。新增擺設時，中文名稱只用中文，並在 `PIECES_JA`（或 `WORDS_JA`）補上日文。
- **座標軸與中心點（像 Maya）**：工具列下方「物／世」切換物件座標（軸跟著擺設自己的方向）與世界座標（整個場景的 X、Y、Z）；每次點選新的物件都先回到物件座標，面板「變換」最上方的色塊（藍＝世界、橘＝物件）隨時顯示目前是哪一種，切換時會跳提示；旋轉值一律記在世界座標裡，切換只改箭頭與位置欄位的軸；位置欄位也跟著換。按 **D**（或工具列的 D）進中心點模式：移動箭頭改成搬中心點（`edit.ts` 的 `pivots`、`setPivot`，存在 localStorage），物件本身不動（自動補償位移），之後旋轉、縮放都繞新中心點；再按 D 回到搬物件。
- **+ / −**：按 X、Y、Z 選軸（再按一次取消），+ 或 − 縮放選到的軸（沒選就三軸一起）；縮放區每軸旁也有 −、+ 按鈕。
- **群組**：清單裡 Ctrl／Shift 點選多件 → 「成組」；群組可一起位移、繞垂直軸轉、整體縮放（轉動中心是成員的中間）。「解散」「改名」「復原」都能用。沒有中心點的東西（閘門）不能成組。預設群組在 `edit.ts` 的 `DEFAULT_GROUPS`（門口招財貓台＋四隻貓 `grp-doorcats`、小神龕的供桌＋供品 `grp-altar`）；解散後記在 localStorage，不會再自動出現。場景裡點到群組成員會選到整個群組（一起移動、旋轉、縮放），按住 Alt 點才單選那一件。選到群組時，群組中心會出現自己的移動箭頭／旋轉環／縮放把手（`Movable.tsx` 的 `GroupGizmo`，房間軸），旋轉 X、Y、Z 三軸都能調（`Group.r`）。
- **座標歸零**（面板下方按鈕，像 Maya 的 Freeze Transformations）：把選到的物件或群組現在的位置、旋轉、大小當成新的 0／1，物件不動，之後面板從這裡算（`edit.ts` 的 `freezeSelected`、`zeroOf`，存在 localStorage `jgs-edit-frozen-1`；「全部還原」會一起清掉）。BDD：`tests/bdd/edit-freeze.test.ts`。
- 進開發者模式會自動收起選單，離開後還原；選單收放或進出開發者模式不會讓鏡頭重新歸位（只有換菜、重設視角、總覽、視窗大小改變才會）。

## 廚房三種模式（`game/mode.ts`）

- **三個視角**：攝影機 1＝研製（鎖定）、攝影機 2＝開發者模式（總覽、自由拖）、攝影機 3＝自由視角（閉店預設）。
- **研製＝火烤灶台視角**：閉店時鏡頭在視角 2（火烤灶台）就是研製模式（`App.tsx` 的 `research = !ai && view === 'grill'`），換到其他視角就離開；營業時沒有研製。研製時右上角（編輯鈕左邊）有一個冷藏櫃小圖示（`fridge-toggle`），點一下開關右側的食材櫃（`ui/Menu.tsx` 的 `chiller`）。食材櫃分三區：冷凍、冷藏、常溫（`data/storage.ts` 的 `storageOf`；清酒、馬鈴薯、地瓜是常溫），底部是試做數量、全部放回，與三個補貨鍵：補到平均（`averageOrder`）、各補 5（`eachOrder`）、補滿（`topUpOrder`，補到 `PAR`）；BDD `tests/bdd/fridge.test.ts`。沒有手動烤魚。**研製**：視角固定在**攝影機 1**，手動夾食物、調味、看每塊的烤魚進度（`roast-tag`）。**營業**（店開著）：廚房自己烤（AI 主廚永遠工作，雇的員工一起），沒有手動烤魚與調味、沒有進度標籤、沒有食材櫃。規則都在 `game/mode.ts`（`modeOf(shopOpen, research)`、`canCookByHand`、`showsProgress`、`showsStockFridge`、`holdsCameraOne`；BDD 情境 `tests/bdd/mode.test.ts`）。
- 研製時：點冷藏櫃拿的食材**直接出現在大砧板（`tray`）上**（`Piece.fresh`，不從火堆滑過去）；烤好夾起的食物**一律放進桌上的試吃碗**（`bowl-0`、`TasteBowl`、`inBowl`，排法同盤子）。
- **攝影機 1**：該道菜的 home 視角（`App.tsx` 的 home），研製時鎖在這裡；開發者模式不再能調整它（`scene/camera1.ts` 的偏移仍會讀，但沒有編輯介面）。dev 時 `window.__freeCam = true` 可以解鎖視角做截圖。
- **視角選單**（左下眼睛鈕）：`data/views.ts` 的 `VIEW_SPOTS`，依序 1 自由視角、2 火烤灶台、3 櫃檯、4 玄關、5 小神龕、6 飲品櫃、7 廁所、8 後台區、9 老闆（`follow`：老闆的第一人稱、廣角 `WIDE_FOV`，跟著他走，閉店時才有）；各區看向一個具名群組（`TillMarble`、`look-door`、`look-altar`、`look-fridge`、`look-wc-m`、`look-back`），預設鏡頭從房間中央那一側、往後 `back`、往上 `up` 看過去（`App.tsx` 的 `poseOf`）。打開選單時場景裡同時標出編號圈圈（`ViewMarkers`，像 Sketchfab 的註記，點一下飛過去）。**除了 1 自由視角，其他視角都鎖定**（不能轉、平移、縮放；App 的 `spotLock`；研製的火烤灶台另由 `lockView` 鎖在攝影機 1），開發者模式不鎖。鎖定的視角都套 `scene/LensFX.tsx`（畫面邊緣模糊、四周暗角；`bulge` 可加魚眼，目前沒用），自由視角與開發者模式沒有。開發者模式下每個視角是一台攝影機（`ViewCams`，Movable id `viewcam-<id>`），可調位置與旋轉；調過的視角就從那台攝影機的位置、朝它指的方向看（`viewCamPlaced`）。
- **開發者模式只做編輯**：場景裡所有互動（夾食物、添炭、調味、澆水、收銀抽屜、廁所門、飲料櫃門、神棚、飯桶蓋、盤子拖曳）都擋掉（Roasting 的 `locked`、各元件的 `getEdit().on`、App 對 `.canvas-layer` 的 click 攔截）。
- 桌上的**行燈、團扇**用 `<Movable>` 包起來；**大砧板（`cutboard`）、調味盒（`seasoning`）、水桶（`bucket`）**是由桌面的 nudge（`moved`）定位的，開發者模式用 `EditProxy`（不畫出來的同尺寸方塊）給框與箭頭，位移量會加進 nudge（食物、鍋具、水瓢跟著走）；這三件只有位移有效，旋轉與縮放沒有作用。
- **能互動的東西都要有名稱標籤**：滑鼠移上去，游標旁出現和備長炭同款的紙標籤（名字＋做法）。3D 物件用 `shops/grill/bar.ts` 的 `tipOver(名稱, 提示)` 取代 `handOver`（會發亮、變手指、設標籤）；標籤的狀態在 `scene/hoverTip.ts`，由 `ui/HoverTip.tsx` 畫（開發者模式隱藏）。不能放在 `StaticBatch` 裡（合併後沒有事件）；門這類小目標用一片透明的感應面（見 `ToiletHit`）。目前沒有標籤的：招財貓、客人、食材冷藏櫃的蓋子（沒有互動）。
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
- 下載來的模型（魚、酒樽、冰箱、招財貓）貼圖用 `blender/shrink_textures.py -- <檔案.glb>…` 縮到 1024 px 並轉 JPEG（只換圖，網格不動）；新加入的外部模型也要跑一次。
- 喇叭（`blender/speaker.py` → `speaker.glb`）與收銀機（`blender/register.py` → `register.glb`，節點 `RegBody` 固定、`RegDrawer` 由遊戲滑出；顯示幕數字、發票、抽屜裡的錢仍由程式畫）也是 Blender 產生；兩者只在 3D 吧台出現，沒有 lite 版。描邊用 `inkModel(root, skip, { width, weld: true })`（細線、平滑法線，硬邊模型不會裂開）。
- 收銀機可以操作（`shops/grill/cashRegister.tsx`）：按鍵（模型節點 `Key_<鍵名>`）與模式鎖（`RegModeKey`，OFF→REG→X→Z）照 `game/register.ts` 的純邏輯運作（BDD：`tests/bdd/register.test.ts`），印出的發票是 `drawReceipt` 畫的；客人結帳時收銀員自動按鍵並記入營業額。dev 時 `__register` 看狀態。r3f 的 `<primitive>` 上的事件不會生效，互動要包一層 `<group>`。
- 收銀櫃上的平板（`blender/ipad.py` → `ipad.glb`，`shops/grill/Ipad.tsx`；螢幕節點 `IpadScreen` 貼遊戲的點單畫面）與下層的紙箱和說明書（`blender/tillboxes.py` → `tillboxes.glb`，`TillBoxes.tsx`；點說明書 `TillManual` 打開 `ui/RegisterManual.tsx`，內容在 `data/registerManual.ts`）。
- 收銀櫃檯本體（`blender/tillcounter.py` → `tillcounter.glb`，`TillCounter.tsx`）：深色木櫃；客人側正面是鬆散不規則的綠竹（每根粗細、傾斜、彎度、竹節、色調（`TillBamboo0`～`4`，`TillCounter.tsx` 的 `BAMBOO_SHADES`）都不同，竹節是一圈細深線加淺色唇，上下兩根橫竹用黑繩綁），後面一片暖光面 `TillBambooGlow` 從竹縫透出；側面圓窗是紙燈（窗紙 `TillWindowPaper` 內退、由裡發光，窗框、內襯、格子是淺色櫸木）；白色大理石檯面（亮面）；隔板是胡桃木立格子（底下深銅色踢腳、上下橫框、立柱、壓頂，格子後面是淺色檜木板，兩個開口端是帶圓頂的圓柱；踢腳、橫框、壓頂沿一條帶圓角的路徑一體成型 `sweep`，轉角是圓柱，沒有接縫），客人側左端（服務鈴那頭）留空，招財貓那端一路延伸到收銀員側邊緣。
- 收銀櫃上的小東西（`blender/tilldesk.py` → `tilldesk.glb`，`shops/grill/TillDesk.tsx`）：筆筒 `TillPens`、明細印表機 `TillPrinter`、刷卡機 `TillCardReader`（桌上型：斜面機身、灰色液晶、導覽鍵、橡膠數字鍵、紅黃綠鍵、內建出單機，前端插著一張卡）、服務鈴 `TillBell`、胡桃木台座 `TillMat`（15 cm 高，正面兩個抽屜、黃銅把手）、找零盤（カルトン）`TillTray`、招財貓石座 `TillCatStand`，各自一個 Movable；服務鈴可以按（`TillBellLive`：按壓桿 `TillBellPlunger` 下壓、叮一聲）。放在台座上的（平板、筆筒、印表機、刷卡機）在 `edit.ts` 的 `BASES` 裡 y 墊高 0.15；它們的線各自收進身後桌墊上的小孔（模型的一部分，跟著移動），平板的線藏在支架裡，收銀機的電源線從機身背後收進機身下的走線孔。**編輯面板顯示的是房間座標，`BASES` 存的是父層座標，寫預設前要用 `fromRoom(id, v)` 換算。**
- 客人（十五種 Q 版角色、每種有幾種髮型隨機搭配、共用一副骨架，動作 Sit／Eat／Walk；出現比例是 `data/guests.ts` 的 `weight`）由 `blender/guests.py` 產生 `public/models/guests.glb`，`scene/Person3D.tsx` 載入後依客人換膚色、髮色、衣服顏色與花紋。手機不跑 3D 吧台，所以沒有 lite 版。

- 其他 Blender 模型：吧台椅與竹盆栽（`blender/barfurnish.py` → `stool.glb`、`bamboopot.glb`，`BarFurnish.tsx`）、廁所免治馬桶與洗手台（`blender/wc.py` → `toilet.glb`、`washstand.glb`）、飯桶（`blender/ricetub.py` → `ricetub.glb`，節點 `RiceTubBody`／`RiceTubLid`／`RiceTubRice`，蓋子仍可點開）。
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

- 客人模型由 `blender/guests.py` 產生：表情（`eyesJoy`、`brows*`、`mouth*`，依評分切換，見 `scene/people.ts`）、走路動作（`Walk`／`WalkF` 女性／`WalkU` 大叔／`WalkO` 老人，速度也不同）、大學生的耳機 `student.phones`。臉型（圓、長、方、瓜子）是在 `scene/Person3D.tsx` 的 `shapeFace` 依 id 變形。
- 備長炭（`blender/binchotan.py` → `binchotan.glb`，`shops/grill/binchotanModel.ts` 的 `useBinchotan`）：六根炭、六種碎塊、六種灰渣（`BinAsh`，灰色顆粒、底部平的），炭用卡通（toon）材質（炭面、凹凸、龜裂發光貼圖）。炭箱、手上拿的、火裡的都用它，丟進火裡外觀不變，隨溫度亮起龜裂紋；燒到 95% 會斷成 3～5 塊往下掉，變成灰（`game/coalPile.ts` 的 `crumble`，BDD `coal-pile`），上面的炭跟著塌下來。**添炭只能從炭箱拖一根炭到火上**（點火堆沒有作用；只有炭能 hover，籃子不行），一次一根（`STICK_COST`、`STICK_BOOST`，BDD `fire`），炭箱少一根（`Decor.tsx` 的 `CRATE`、`takeFromCrate`，拿完換一箱）。火力條的按鈕與 AI 主廚仍是一次一份（6～7 根，`COAL_PER_ADD`）。
- 水桶與水瓢在 `blender/grilledfish.py`（`WaterBucket`、`WaterDipper`、`DipperWater`）：杉木桶板、竹箍。指到整個水桶就是拿水瓢：先舀水（水瓢沉進桶裡再提起，杯裡有水），放開就倒水（傾倒、水流），倒在食物上是灑水、倒在炭上是澆熄。
- 神棚（`blender/kamidana.py` → `kamidana.glb`，`DiningRoom.tsx` 的 `KamidanaModel`）：三社造的檜木神棚，金屬配件（千木、鰹木的金頭、屋脊、門上的金紋、擬寶珠、台階金片）用真金屬材質並反射 `scene/studio.ts` 的攝影棚環境（金屬靠反射才看得出是金屬，店內光暗也照樣亮）；橘子盤 `KamiOranges`、經本 `KamiSutra` 也在同一個檔裡。倒酒時杯中酒面依杯子內壁的半徑長高（`cupInnerR`），不會穿出杯子。
- **供花**（神棚兩側花瓶，點一下換花，存在 localStorage `jgs-shrine-flowers-1`）：三組花各有加持（`game/shrineFlowers.ts`，BDD `shrine-flowers`）：榊與小菊＝平安（客人耐心較長）、白金菊（`shrinevase.py` 變體 0：輪菊、糸菊、小菊）＝金運（更常拿飲料）、紅粉花（變體 1：芍藥、紅椿、桔梗、霞草）＝良緣（情侶較常來）；兩瓶同一種加倍。神棚門聲（`shrineSound.ts`）是黏滑摩擦合成的吱呀聲＋檜木共鳴＋門扣與門片碰撞聲。
- 供清酒（點門口神棚前的酒瓶）：60 秒內來客變多、每人點得較多（`App.tsx` 的 `lightIncense`、Roasting 的 `blessed`；名稱沿用舊的點香）。
- 招牌字：`scene/signFont.ts`（Zen Antique，字體載入後貼圖會重畫；新增招牌用到的字要同步加到 index.html 的字體請求）。
- **擋住視線的吊掛物會變淡**：`scene/OccluderFade.tsx` 每幾格從鏡頭朝看的目標（`__ctl.target` 在畫面上的位置，周圍一圈）打射線，標了 `userData.fade` 的群組（門簾、紅燈籠、旗幟串、幟旗、燈串、吊燈）擋在中間就淡到 18%，移開就恢復（各自複製材質，不影響共用同一材質的東西）。新的吊掛擺設要會變淡，就在它的群組加 `userData={{ fade: true }}`。
- **收銀抽屜的錢**（`game/till.ts` 的 `openingFloat`／`deposit`／`takeOut`，BDD `till`）：付現的客人把帳單放進抽屜；抽屜開著時老闆點紙鈔格或硬幣格把整格拿走，加進現金（帳本的「收銀機取款」，`ledger.till`）。
- **碗盤櫃是盤子的來源**（`game/plates.ts`，BDD `plates`）：櫃上顯示幾個就是幾個；點一下搬一疊到出餐口（最多 12 個），出餐口空了服務生自己去拿，洗好放不下的回到櫃上。
- **自動營運的營業套路**（`game/flow.ts`，BDD `flow`）：每次開店抽一種（平日、午餐尖峰、晚餐尖峰、雨天、祭典、觀光團、熟客日），各自的來客節奏、結伴比例、點單量不同，開店時主廚會說。
- 店面沿吧台縮短了 `BAR_TRIM`（`bar.ts`）；玄關 `GENKAN.along` 往吧台拉長。
- 卡頓時 `scene/FramePacer.tsx` 會自動降解析度，再不行就鎖 30fps；右上角 ×2 是遊戲倍速（`scene/speed.ts` 的 `GAME_SPEED`：3D 時鐘由 FramePacer 手動推進，App 的計時器也乘上它）。

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
