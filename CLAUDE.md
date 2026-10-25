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
- 遊戲裡的編輯模式（按 G，閉店時才能用）調的位置存在瀏覽器裡；確定後把面板上的 offset 數值告訴雲端 chat，由它寫成預設值。

## 編輯模式（`src/shops/grill/edit.ts`、`Movable.tsx`）

- 介面是 Blender 風格的深灰面板：左邊工具列（位移 W、旋轉 R、縮放 S），清單可搜尋，變換區的 X／Y／Z 是紅綠藍色條。位置、移動箭頭、旋轉環、縮放把手都用**房間軸**（吧台方向 `ALONG`），不是各物件父層的軸。
- 每件能動的擺設用 `<Movable id label>` 包起來（裡面放自己的 `<StaticBatch>`；Movable 不能放在別的 StaticBatch 裡面）。選取框是從模型畫出來的頂點量的（不含墨線、貼面、發光），所以貼合模型。
- **預設值**：位置預設寫在 `edit.ts` 的 `BASES`（父層單位）；大小與轉向預設用 `<Movable baseScale baseTurn>`。定好預設後面板歸零（位置 0、縮放 1）。改了預設要把 `edit.ts` 開頭的三個 localStorage key 版本加一，不然瀏覽器裡舊的偏移會重複計算。
- **+ / −**：按 X、Y、Z 選軸（再按一次取消），+ 或 − 縮放選到的軸（沒選就三軸一起）；縮放區每軸旁也有 −、+ 按鈕。
- **群組**：清單裡 Ctrl／Shift 點選多件 → 「成組」；群組可一起位移、繞垂直軸轉、整體縮放（轉動中心是成員的中間）。「解散」「改名」「復原」都能用。沒有中心點的東西（閘門）不能成組。
- 進編輯模式會自動收起選單，離開後還原；選單收放或進出編輯模式不會讓鏡頭重新歸位（只有換菜、重設視角、總覽、視窗大小改變才會）。

## 廚房三種模式（`game/mode.ts`）

- **三個視角**：攝影機 1＝研製（鎖定）、攝影機 2＝編輯模式（總覽、自由拖）、攝影機 3＝自由視角（閉店預設）。
- **自由**（閉店預設，攝影機 3）：視角自由，**右邊沒有任何介面**（菜單板與收合鈕只在研製或營業時出現）；沒有手動烤魚。**研製**：閉店時按右上角圓形綠色「研」鈕切入（再按離開），視角固定在**攝影機 1**，手動夾食物、調味、看每塊的烤魚進度（`roast-tag`）、食材冷藏櫃（`ui/Menu.tsx` 的 `bin`，在畫面右側，每格點一下拿一份試做、+1／+10 叫貨、補 = 補到 `PAR`）。**營業**（店開著）：廚房自己烤（AI 主廚永遠工作，雇的員工一起），沒有手動烤魚與調味、沒有進度標籤、沒有冷藏櫃；開店會自動離開研製。規則都在 `game/mode.ts`（`modeOf(shopOpen, research)`、`canCookByHand`、`showsProgress`、`showsStockFridge`、`holdsCameraOne`；BDD 情境 `tests/bdd/mode.test.ts`）。
- 研製時：點冷藏櫃拿的食材**直接出現在大砧板（`tray`）上**（`Piece.fresh`，不從火堆滑過去）；烤好夾起的食物**一律放進桌上的試吃碗**（`bowl-0`、`TasteBowl`、`inBowl`，排法同盤子）。
- **攝影機 1**：預設是該道菜的 home 視角（`App.tsx` 的 home），可在編輯模式選「攝影機 1（研製視角）」調位置與旋轉（`scene/camera1.ts`；畫成攝影機加視錐，由 `CameraRig` 畫）；編輯模式本身視角是自由的，離開後回到原本的模式。dev 時 `window.__freeCam = true` 可以解鎖視角做截圖。
- **編輯模式只做編輯**：場景裡所有互動（夾食物、添炭、調味、澆水、收銀抽屜、廁所門、飲料櫃門、神棚、飯桶蓋、盤子拖曳）都擋掉（Roasting 的 `locked`、各元件的 `getEdit().on`、App 對 `.canvas-layer` 的 click 攔截）。
- 桌上的**行燈、團扇**用 `<Movable>` 包起來；**大砧板（`cutboard`）、調味盒（`seasoning`）、水桶（`bucket`）**是由桌面的 nudge（`moved`）定位的，編輯模式用 `EditProxy`（不畫出來的同尺寸方塊）給框與箭頭，位移量會加進 nudge（食物、鍋具、水瓢跟著走）；這三件只有位移有效，旋轉與縮放沒有作用。
- **能互動的東西都要有名稱標籤**：滑鼠移上去，游標旁出現和備長炭同款的紙標籤（名字＋做法）。3D 物件用 `shops/grill/bar.ts` 的 `tipOver(名稱, 提示)` 取代 `handOver`（會發亮、變手指、設標籤）；標籤的狀態在 `scene/hoverTip.ts`，由 `ui/HoverTip.tsx` 畫（編輯模式隱藏）。不能放在 `StaticBatch` 裡（合併後沒有事件）；門這類小目標用一片透明的感應面（見 `ToiletHit`）。目前沒有標籤的：招財貓、客人、食材冷藏櫃的蓋子（沒有互動）。
- **牆角喇叭**（`DiningRoom.tsx` 的 `WallSpeaker`）是音樂唯一的開關：點一下開、再點一下關，預設關（`ui/bgmStore.ts`，`ui/Bgm.tsx` 負責播放，音量固定）；hover 會發亮並出現「音箱／點一下開啟（關閉）音樂」標籤，開著時飄出音符（`MusicNotes`）。沒有任何音樂的 2D 介面或按鈕。
- **客人的盤子**：`shops/grill/wareDesigns.ts` 五款花色（唐草、青海波、鯉魚、梅花藍底、風車）依盤子輪流用；竹、梅仍是 `ware.ts` 的大盤與小碟。`PlateRack.tsx` 是碗盤櫃架（Decor 裡的 `RackAt`）。
- **編輯模式左下角**有世界座標小圖（`App.tsx` 的 `AxisWidget`）：X 沿吧台、Y 向上、Z 橫過吧台，隨鏡頭轉。
- **介面風格**：木紋深色外框與標題列、半透明淺色面板（`index.css` 末尾的 `--grain-dark`、`--grain-light`）；只是按的東西（食材卡、補貨鈕）用半透明玻璃，不用木色。
- **HDRI**：`scene/IndoorHDRI.tsx` 有 `public/hdri/day.hdr`、`night.hdr`（polyhaven.com/hdris 的 1k .hdr）就用真的，沒有就用內建的假 HDRI。**BGM**：`ui/Bgm.tsx` 找 `src/IzakayaNight.mp3`（或 `public/audio/`）。

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
- 供清酒（點門口神棚前的酒瓶）：60 秒內來客變多、每人點得較多（`App.tsx` 的 `lightIncense`、Roasting 的 `blessed`；名稱沿用舊的點香）。
- 招牌字：`scene/signFont.ts`（Zen Antique，字體載入後貼圖會重畫；新增招牌用到的字要同步加到 index.html 的字體請求）。
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
