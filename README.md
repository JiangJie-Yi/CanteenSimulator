# 聞野・日式烤魚（JapaneseGrillSimulator）

在瀏覽器裡玩的手繪風 3D 日式烤魚店經營遊戲。

他拖著一只行李箱，隻身從台灣來到大阪天滿的窄巷，開了一間只有八個座位、一座圍爐裏的烤魚店「聞野」。備長炭一根根燒成灰，冷凍櫃裡的魚一天天倒數鮮度，時薪、水電從掀開暖簾那一刻就沒停過。這不是一間悠閒的小店，是一場生存戰：顧好火候、算好帳，把每條魚烤出焦香。

**線上遊玩：** https://jiangjie-yi.github.io/CanteenSimulator/ （電腦與平板；手機版目前暫不開放）

## 玩法

### 研製：自己試烤
- 切到火烤灶台視角（鍵盤 2）就是研製模式。
- 從庫存（冷凍櫃、冷藏櫃、常溫區）拿食材到砧板，拖到火上烤；拿調味料停在食物上方就會撒、刷、點上去。
- 從炭箱拖一根備長炭到火上添火，用水瓢澆水降溫。
- 烤好的放進試吃碗，點一下讓老闆走過來試吃、給評語。

### 經營
- 開店時手上 **NT$200,000**（存了半輩子的 30 萬，扣掉開業費用 10 萬）。
- **庫存**（右上角的冷藏櫃圖示）：冷凍、冷藏、常溫、飲料、耗材五頁。食材會變質，冷凍櫃的溫度影響鮮度，壞掉的吃了會拉肚子；調味料、備長炭、衛生紙、發票紙都是耗材。
- **經營**（點右上角的現金）：帳簿、人事、廚房。可以雇二廚、三廚、外場、收銀、倉儲，每個人的手藝、速度、時薪都不同；倉儲會自己補貨、換廁所衛生紙。
- **水電**：每樣電器、每次用水都照台電、台水的累進費率算。
- **常溫區的白米**：滑鼠移到菰樽旁的米袋上看剩幾份，點一下打開庫存的常溫區補貨；飯糰用的就是這份白米。
- **收銀抽屜**：老闆可以把紙鈔格、硬幣格的錢整格拿走，抽屜裡銀行包好的棒金（100、10、1 圓各一捲，每捲 50 枚）也能取出，加進現金。

### 營業
- 右上角的開店鈕。營業時由 AI 主廚掌爐，客人從門簾走進來、點餐、用餐、上廁所、拿飲料、結帳。
- 客人點菜後，主廚照點單的先後走去冷凍櫃、冷藏櫃、飯桶或麻袋拿食材，捧回砧板備料，再插到炭火上；鹽烤的烤到一半會搧火。
- 主廚就地裝盤，外場進廚房端走送到座位；吃完的盤子收回流理台、洗好進烘碗機、再放回碗盤櫃。
- 每位客人離開時給評價（點左上角的招牌看）：等太久、沒衛生紙、廁所髒、太暗都會扣分。
- 遊戲時間現實 1 秒 = 遊戲 1 分鐘，有清晨、白天、黃昏、黑夜；晚上關燈客人就不進來。

## 操作

| | 電腦 |
|---|---|
| 切換視角 | 左下角的眼睛按鈕，或鍵盤 1～9、0（自由視角、火烤灶台、櫃檯、玄關、小神龕、飲品櫃、廁所、後台區、窗口、老闆） |
| 轉動、平移、縮放 | 自由視角時：左鍵拖曳、右鍵拖曳、滾輪 |
| 互動 | 滑鼠移到東西上會出現名稱標籤，能點的游標會變手指 |
| 關閉面板 | Esc，或點場景空白處 |
| 音樂 | 點牆角的喇叭 |
| 日夜 | 點右上角時鐘上的圖示，跳到下一段時間 |

## 效能（2026-11-04，Intel Arc B580、1920×1080、最高畫質）

| 指標 | 數值 |
|---|---:|
| 閉店總覽的繪製次數 | 約 1,190 |
| 閉店總覽的三角面 | 約 61 萬（一晚的減面前約 78.5 萬） |
| 著色程式 | 128（全部在載入時編好，營業中不再編） |
| 正式版連續營業 20 分鐘 | 58～61 FPS，最差一格 18～29 ms，記憶體持平 |

`npm run bench` 可以自己量（靜態指標，加上依序切換十個視角、開關燈、進出開發者模式時的平均 FPS、1% Low 與記憶體變化）。

## 技術

- React 19 + TypeScript + Vite
- three.js（@react-three/fiber、@react-three/drei），卡通著色與描邊
- 3D 模型都由 `blender/*.py` 腳本產生（Blender 5.2），只有招財貓與飲料冷藏櫃是外部模型（見 Credits）
- 遊戲規則是純邏輯（`src/game/`），以 BDD 情境測試（`tests/bdd/`）
- 音效（炭火、門、水、收銀機……）都由 Web Audio 即時合成
- 效能：不會動的零件依材質合併、素色零件共用一個材質（顏色寫在頂點上）、人物是一個剛性蒙皮網格加一條描線（每人 2 次繪製）、重複的小東西用 InstancedMesh、著色程式在載入時預先編譯
- 版本：`package.json` 的 `gameVersion`（目前 0.01，遊戲裡店家評價的「關於」頁可以看到）；交接與待辦見 `HANDOFF.md`

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173/JapaneseGrillSimulator/
npm test         # 單元測試與 BDD 情境
npm run e2e      # 瀏覽器實際玩一遍（需先開開發伺服器）
npm run bench    # 性能測試（需先開開發伺服器）
npm run build    # 產生 dist/
```

推到 `main` 會由 GitHub Actions 測試、建置，並部署到 GitHub Pages。

## Credits

- Lucky cat (招き猫) model: "Lucky cat with animation cute maneki neko" by Noth+ Studio, licensed under Creative Commons Attribution 4.0 (CC BY 4.0), via Sketchfab. Converted for use here (poses baked into plain meshes, re-textured materials).
- Lucky cat (招き猫) model: "Lucky cat maneki neko" by Rice & Soy Sauce (@rice_soysauce), CC BY 4.0, via Sketchfab.
- Lucky cat (招き猫) model: "Maneki neko" by Ramujiro (@Ramzus), CC BY 4.0, via Sketchfab.
- Drinks fridge model: "medium freezer" by ALEXPROXY, CC BY 4.0, via Sketchfab. Scaled, re-materialled and its door given a hinge for use here.
