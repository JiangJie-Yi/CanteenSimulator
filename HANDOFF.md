# 交接（新 chat 用）

先讀 `CLAUDE.md`（開發守則與同步流程），再讀本檔。雲端 chat 只推 `cloud-work`，**不要推 `main`**（推 `main` 會部署網站）；改完檢查順序：`npx tsc -b` → `npm test`（46 項）→ commit → `git fetch origin && git merge origin/main` → `git push origin cloud-work`。使用者的本機用 `npm run dev:sync` 拉 `cloud-work`，在 http://localhost:5173/JapaneseGrillSimulator/ 看。使用者每次改動都要在 localhost 看到變化。

## 使用者的習慣與要求
- 要真的測過才說完成（Playwright：`/opt/pw-browsers/chromium --use-gl=swiftshader`，開發用 `__scene`、`__cam`、`__ctl`、`__edit`、`__till`、`__fire`、`__coals`、`__dropCoals`）。
- 方向用鏡頭位置判斷，不要猜；盡量用數值驗證，截圖只截目標區域。
- 一次一步，說完後先排程；不要自動推 `main`。
- 回報只講結果、已驗證與未驗證的部分。

## 這個 chat 做完的
- 編輯模式（G，閉店才能用）：位移／旋轉／縮放（W／R／S），XYZ 欄位、復原重做、單件與全部還原；**確認／取消按鈕**（取消或按 G、「編」、開店都會回到進入前的位置、大小與方向）；手把螢幕上固定大小；縮放中間方塊三軸一起縮；旋轉改 Blender 式三色環；遊戲操作鎖住（選單、營業開關等不可按，點 3D 畫面不觸發遊戲）。
- 可選取的件（`src/shops/grill/edit.ts` 的 BASES 與各 `<Movable id>`）：閘門門板、食材冷凍櫃、柳樹、酒樽、竹盆栽、酒箱、員工墊、鞋櫃、座位、供桌、神龕、神龕旁花瓶與杯、橘子盤、御神酒壺、招財貓台、四隻招財貓。
- 收銀機：顯示器降低、發票只在結帳時印出、抽屜只能從正面點、抽屜前板直角。
- 木炭：不再顯示模型自帶的橘色六角形炭堆；只有丟進去的長備炭（較粗短的中空圓管）；點燃但沒有炭時會自動先擺幾根。
- 選單：翻頁箭頭淺色半透明小圓鈕（位置上移）；收合鈕黑漆金邊。
- BGM：`src/ui/Bgm.tsx`，讀 `public/audio/izakaya-night.mp3`，右上有 ♪ 開關。**mp3 檔使用者只放在自己電腦，尚未進 repo**。

## 待辦
1. 【你】把「居酒屋の夜.mp3」複製成 `public/audio/izakaya-night.mp3`（雲端看不到你電腦上的檔案；是否提交進 repo 由你決定，檔案大就別提交，改放在本機即可）。
2. 門簾（noren）魚圖再精進（`GuestBar3D.tsx` 的 `norenTexture`；參考使用者給的「圈＋跳躍的魚＋波浪」圖）。
3. 收銀機細節：灰塵污漬磨損、背面纜線、側面接口孔（參考 Sharp 圖）。
4. 爐裡炭的原始橘六角形模型已隱藏；若要換掉模型本身需 Blender（`blender/grilledfish.py`）。
5. 重跑完整 e2e：`node tests/e2e/flow.mjs http://localhost:5173/ grilledfish`（約 7 分鐘），確認這輪改動後流程仍通過。
6. 編輯模式還沒涵蓋：吧台本體、收銀台、飲料櫃、廁所（會影響客人動線）。
7. 【你】GitHub repo 改名 JapaneseGrillSimulator。
8. 【你】看一遍畫面是否到位。

## 注意
- stop hook 常誤報「有未推送提交」：實際比對 `git ls-remote origin cloud-work` 與 `git rev-parse HEAD`；必要時 `git fetch origin cloud-work:refs/remotes/origin/cloud-work` 更新本機追蹤記錄。
- 開發伺服器在雲端常中斷：`setsid nohup npx vite --port 5173`；不要用 `pkill`（會殺掉自己的 shell）。
