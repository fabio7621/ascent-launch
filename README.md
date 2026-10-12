# 升空計畫 Ascent

捲動驅動的火箭升空動畫：發射台 → 穿越大氣 → 衝出卡門線。
Vue 3 負責介面（遙測 HUD、事件字卡、高度計、任務摘要），three.js 負責 3D 場景。
畫面和所有遙測數字都來自頁面載入時跑的一次兩級火箭飛行模擬。

## 開始

```bash
npm install
npm run dev       # 開發伺服器
npm run build     # 輸出到 dist/
npm run preview   # 預覽 build 結果
```

`vite.config.js` 設了 `base: './'`，`dist/` 可以直接放到 GitHub Pages 這類子路徑。

## 資料夾結構

```
src/
├─ main.js                    進入點
├─ App.vue                    組裝畫面；每一幀更新場景，再把狀態抄到 HUD
├─ styles/main.css            全域 token（顏色、字體）與章節共用樣式
├─ components/
│  ├─ TopBar.vue              品牌、章節導覽、聲音開關
│  ├─ HeroSection.vue         首屏文案
│  ├─ EventCard.vue           左側事件字卡（交叉淡入淡出＋進度線）
│  ├─ AltimeterPanel.vue      右側大氣分層高度計與讀數
│  ├─ TelemetryHud.vue        底部遙測 HUD（一級／二級兩組）
│  ├─ ArcGauge.vue            270° 圓弧儀表
│  ├─ EngineMap.vue           引擎點火狀態圖（33 具／6 具）
│  ├─ PropellantBars.vue      LOX / CH4 剩餘量條
│  ├─ MissionTimeline.vue     任務時間軸
│  ├─ MissionSummary.vue      結尾任務摘要屏（右上角可關閉，進入自由觀察）
│  ├─ FreeLookOverlay.vue     自由觀察的操作提示、不明訊號提示、黑騎士準星
│  └─ ObservationPanel.vue    黑騎士觀測視窗（物體檔案、訊號解碼、聯絡資訊）
├─ config/profile.js          觀測視窗裡的個人資訊（GitHub、作品集、Email）
├─ composables/
│  ├─ useScrollMission.js     捲動位置 → 任務時間（熱分離前後放慢）
│  └─ useLaunchAudio.js       WebAudio 合成火箭聲，隨外界氣壓變小
├─ sim/
│  ├─ flightSim.js            兩級火箭飛行模擬（重力轉彎、指數大氣、Max-Q、熱分離、返航）
│  ├─ flightData.js           執行模擬、依時間查表 sampleAt(t)、衍生事件
│  └─ missionEvents.js        字卡內容、階段文字、時間軸里程碑、大氣分層
├─ scene/
│  ├─ LaunchScene.js          three.js 場景：天空與地球、發射台、火箭、尾焰、粒子、鏡頭
│  ├─ blackKnight.js          彩蛋：黑騎士衛星的程序化模型與動畫
│  ├─ textures.js             程序化外殼貼圖（焊縫、結霜、煙灰、隔熱瓦、法線）
│  └─ glsl.js                 共用 GLSL 片段
└─ utils/format.js            數字與任務時鐘格式
```

## 資料怎麼流動

1. `flightData.js` 在載入時跑完整條模擬，存成每 0.1 秒一筆的表。
2. 捲動時 `useScrollMission` 把 `scrollY` 換成任務時間，寫進 `scene.state.tTarget`。
3. `App.vue` 的 `requestAnimationFrame` 迴圈讓 `state.t` 平滑追上目標，呼叫 `scene.update()`、`scene.render()`。
4. 再把 `scene.state` 的數值抄到 `reactive` 的 `hud`，各個元件用 props 顯示。

three.js 物件不放進 Vue 的響應式系統，只把需要顯示的數字交給 Vue，這樣每幀更新的成本很低。

## 結尾互動與彩蛋

1. 捲到最後的任務摘要，按右上角「自由觀察」關閉摘要。
2. 拖曳 360° 旋轉、滾輪或雙指縮放；點太空船（或按 Esc、或按「回到摘要」）摘要會再出現。
3. 自由觀察時，太空船後下方有一個閃紅光的黑色物體。滑過去會鎖定，點下去鏡頭會飛過去近距離觀測，並跳出觀測視窗。
4. 觀測視窗右下角的 CONTACT ME 會在新分頁開啟作品集，同時主畫面回到發射前。

鏡頭的三種模式（`flight`／`free`／`observe`）都在 `LaunchScene.js` 的 `setMode()`。
自由觀察時改由 three.js 的 `OrbitControls` 接手，頁面捲動會被鎖住，讓滾輪交給鏡頭縮放。

## 常改的地方

- 觀測視窗的個人資訊：`src/config/profile.js`（`email` 填上就會顯示）
- 黑騎士的位置：`LaunchScene.js` 的 `BK_OFFSET`（相對二級中心，單位公尺）

- 字卡文字與出現時間：`src/sim/missionEvents.js` 的 `CARDS`（`t0`／`t1` 是任務秒數）
- 捲動節奏：`src/composables/useScrollMission.js` 的 `ASCENT_KEYS`（捲動比例 → 任務秒數）
- 火箭參數（推力、質量、節流、導引）：`src/sim/flightSim.js` 開頭的 `B`、`S` 與 `G_LIM`、`KICK`
- 鏡頭機位：`src/scene/LaunchScene.js` 的 `updateCamera()`，各機位依任務時間混合
- 章節長度：`src/styles/main.css` 的 `.track`（520vh）與 `.space-track`（300vh）

## 版本說明

three.js 固定在 0.128.0。之後的版本改了色彩管理與後製 API（例如 `outputEncoding`），
升級會讓畫面顏色和泛光效果改變，要升級時需要一起調整 `LaunchScene.js` 的渲染設定。
