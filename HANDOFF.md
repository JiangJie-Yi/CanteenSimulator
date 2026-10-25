# 交接（新 chat 用）

先讀 `CLAUDE.md`（開發守則、同步流程、BDD、編輯模式），再讀本檔。雲端 chat 只推 `cloud-work`，**不要推 `main`**（推 `main` 會部署網站）；改完檢查順序：`npx tsc -b` → `npm test`（93 項）→ commit → `git fetch origin && git merge origin/main` → `git push origin cloud-work`。使用者的本機用 `npm run dev:sync` 拉 `cloud-work`，在 http://localhost:5173/JapaneseGrillSimulator/ 看。

## 使用者的習慣與要求
- 要真的測過才說完成（Playwright：`/opt/pw-browsers/chromium --use-gl=swiftshader`；開發用 `__scene`、`__cam`、`__ctl`、`__edit`、`__till`、`__fire`、`__coals`、`__dropCoals`）。軟體 GL 約 10 FPS，等待要放長。
- 方向用鏡頭位置判斷，不要猜；盡量用數值驗證，截圖只截目標區域（可用 `addStyleTag` 把 `.menu` 藏起來）。
- 新行為先寫成 BDD 情境（`tests/bdd/`）再實作。
- 回報只講結果、已驗證與未驗證的部分。
- 雲端碰不到使用者的電腦：BGM 的 mp3、休眠電腦都要請使用者自己做。

## 這個 chat 做完的（摘要）
- 編輯模式：Blender 風格面板、房間軸、貼合模型的選取框、+/− 縮放、群組、預設值寫進 `BASES`／`baseScale`／`baseTurn`、進入時收選單且不重設鏡頭。物件拆得很細（收銀台 9 件、牆上每幅畫、廁所裡的小東西、酒樽與餐盤堆、門簾／紅燈籠／玄關地墊…）。廁所整間、爐子、吧台、行燈、扇子沒拆（牽涉動線或玩法）。
- 炭火：真實尺寸的堆疊（不浮空、最多三層、疊在別根上的才會滑、滑不遠）、炭堆滿且還在燒就不能再加、火力 100% 不能再加（`game/economy.ts` 的 `canAddCharcoal`）、燒完變灰白的炭而不是縮短、黑炭裂縫發光加餘燼床。
- 收銀機：顯示器擺正、抽屜好點、灰塵污漬磨損、背面纜線、側面接口；冷藏櫃去掉「食材」字牌與地板飾條。
- 場景：日夜不同的 HDRI、牆頂燈串、和紙吊燈、神龕兩格階梯加帶小門的圍欄、門簾家紋魚圖。
- BGM：`src/ui/Bgm.tsx` 先找 `src/` 底下的音檔（使用者本機是 `src/IzakayaNight.mp3`，用 `import.meta.glob`，沒有檔也不會壞建置），再依序試 `public/audio/izakaya-night.mp3`、`居酒屋の夜.mp3`、m4a／ogg／wav；找不到時按鈕提示要放的路徑。檔案要提交進 repo 才會跟著部署。
- HDRI：`src/scene/IndoorHDRI.tsx` 若有 `public/hdri/day.hdr`、`night.hdr`（polyhaven.com/hdris 的 1k .hdr，CC0）就用真的，沒有就用內建的假 HDRI。雲端連不上 polyhaven，所以沒放檔。
- 瘦身：移除沒人用的匯出（`starsFor`、`COIN_R`、`KITCHEN_TOP`、`resetOne`、`equilibriumTemp`、`MiniStomach`）、翻頁箭頭與迷你胃的 CSS、Blender 備份檔、`__pycache__`、`blender/archive`、`public/icons.svg`。

## 後來加的
- 廚房三模式（`game/mode.ts`）：自由（閉店預設，自由視角）／研製（按右上「研」鈕，鎖攝影機 1，冷藏櫃在右側，食材直接出現在大砧板，烤好的進試吃碗）／營業（廚房自己烤）。編輯模式擋掉所有場景互動；行燈、團扇、大砧板、調味盒、水桶也有編輯框（後三者只有位移）；火堆內的炭與炭籃同款長條、灰渣圈已移除。
- 炭火改成有稜角的炭塊、裂縫對齊溝槽發光；櫃台線路收成一束、加 iPad；收銀抽屜內部依日圓重做；飯桶更多細節；水桶箍圈改成片狀；吊燈圓形；傘移除；編輯模式面板顯示家具總數。

## 待辦
1. 【你】`src/IzakayaNight.mp3` 要提交進 repo（雲端看不到；網站才會有 BGM）；另外下載日夜兩張 HDRI 放進 `public/hdri/`。
2. 吧台本體、爐子與石頭、行燈、扇子還沒做成編輯物件（等使用者決定）。
2b. HDRI：雲端連不上 polyhaven，還沒放真檔；使用者放進 `public/hdri/` 後確認有套用（白天／夜晚不同）。
3. 【你】GitHub repo 改名 JapaneseGrillSimulator（push 時 GitHub 提示已搬到 JiangJie-Yi/CanteenSimulator）。
4. 【你】看一遍畫面是否到位；編輯模式的舊設定若看起來歪，按「全部還原」。

## 注意
- stop hook 常誤報「有未推送提交」：實際比對 `git ls-remote origin cloud-work` 與 `git rev-parse HEAD`。
- 開發伺服器在雲端常中斷：`setsid nohup npx vite --port 5173`；不要用 `pkill`。重啟後第一次載入很慢。
- e2e 在雲端：`CHROME_PATH=/opt/pw-browsers/chromium OPEN_FOR=240000 node tests/e2e/flow.mjs http://localhost:5173/JapaneseGrillSimulator/ grilledfish`（約 7 分鐘，跑的時候別改檔，熱更新會重載頁面）。
