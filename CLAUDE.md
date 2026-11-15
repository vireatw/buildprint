# 築跡 Buildprint — project guide for Claude Code

Live site: https://buildprint.tw · Repo: `vireatw/buildprint` · Owner: Danny (GitHub `vireatw`)

A construction daily-report app (工地日報) for Taiwanese job sites. Crews and machines are entered per day (整日／上午／下午／晚上), with work items per crew and per machine, photos, notes, 打卡, an annotated site plan, and an isometric 「工地動畫」 that replays each day from the reports. It started as a Claude artifact and moved here in Nov 2026.

## How to talk to Danny
- Reply in **Traditional Chinese (Taiwan)** unless he writes in English. Keep answers short, about one phone screen.
- He is not a programmer and often works from an **iPhone or iPad**. Give tap-by-tap steps for anything outside the code (Firebase console, GitHub settings, Porkbun).
- After every push, tell him what changed and to open `https://buildprint.tw/?v=<new number>` (GitHub Pages caches for about 10 minutes).
- He cares a lot about **alignment and visual polish**. Check spacing, edges and baselines before calling a UI change done.

## Standing rules
- **日報 and 工地動畫 must stay in sync, both ways.** Anything entered in 填日報 (crews, machines, vendors, counts, shifts, each crew's and machine's 工作事項 and zone) must show in the animation; anything added, moved or deleted in the animation's 編輯 mode must be written back to that day's report. Check both directions before pushing.
- Machines count as a 工種 and each machine as one person in the 工種 summary.
- Don't put real people's or companies' data in examples or demo data beyond what is already there.

## Files
| File | What it is |
| --- | --- |
| `index.html` | The whole app: HTML, CSS and vanilla JS in one file, no framework, no build step. Edit it directly. |
| `backend.js` | ES module. Loads Firebase 10.12.2 from gstatic and provides `window.claude.use(name)` for `db`, `user`, `assets`, `downloads`, the API index.html was written against (see below). Also the sign-in screen, invite codes, the 成員與邀請碼 card and 「從舊版匯入」. |
| `sim3d.js` | ES module: the 3D 工地動畫 renderer (three.js). **The only renderer** (since Nov 2026 Danny wants 3D only; there is no switch). It loads as the page opens; the old 2D canvas drawing in `simDraw` stays only as a silent fallback for a device whose WebGL cannot start. index.html keeps the whole simulation (`simBuild`/`simUpdate`) and all taps/drags/labels; `simDraw` hands the state to `SIM.gl.render(st, view)` and then draws only labels, weather and 編輯 marks on the 2D canvas on top. The orthographic camera matches `SP()` exactly, so anything new drawn in 3D must use site coords (three X = x, Z = y, Y = height). |
| `three.module.min.js` | three.js r170 (MIT), loaded only by sim3d.js. |
| `config.js` | Firebase web config (public by design; data is protected by the rules). |
| `firestore.rules` | Security rules. **GitHub does not deploy these**: after changing them, Danny pastes the file into Firebase → Firestore Database → 規則 → 發布. |
| `CNAME` | `buildprint.tw` for GitHub Pages. |
| `concrete.jpg`, `plan-demo.svg` | Header texture; demo plan (only used in preview mode). |
| `favicon.ico`, `favicon-*.png`, `apple-touch-icon.png`, `icon-512*.png`, `logo-icon.png`, `logo-print.png`, `logo-lockup.png`, `manifest.webmanifest` | Logo (since Nov 2026): the word BUILD in white, its letters filling a footprint shape, with 築跡 and BuildPrint underneath, on navy #14212E. The browser-tab icon (`favicon.ico`, `favicon-32.png`, `favicon-192.png`) is the BUILD footprint only; the home-screen icons (`apple-touch-icon.png`, `icon-512.png` with rounded corners, `icon-512-maskable.png` with the artwork inside the safe circle) show the full lockup, as does the loading screen (Danny's choice); the sign-in screen uses `logo-icon.png` (the BUILD footprint alone on navy) beside the words 築跡. `logo-print.png` is the white footprint alone (transparent), used for the walking footprints on the loading screen in backend.js; `logo-lockup.png` is the full logo (BUILD footprint over 築跡 over BuildPrint) in white on transparent, shown on that loading screen. |

## How the data layer works
`index.html` only talks to `window.claude.use('db' | 'user' | 'assets' | 'downloads')`. `window.BP_WEB` (stub in `<head>`, filled by backend.js) is non-null only on the website; `init()` awaits `BP_WEB.ready`, which resolves after sign-in and membership.
- **db**: Firestore-like wrapper: `doc(path).get/set/update/delete/onSnapshot`, `collection(path).orderBy/limit/where/get/onSnapshot`. Snapshots have `exists` (boolean), `data()`, `docs`, `metadata.fromCache`. Listeners use `includeMetadataChanges` and offline persistence.
- **Paths**: `site/info` (main site), `sites/{id}` (other sites), `reports/{YYYY-MM-DD}` and `sites/{id}/reports/{date}`, `punch/{uid}`, `visits/{uid}`, `profiles/{uid}` (`{name}`), `members/{uid}` (`{role:'edit'|'view', code, name, email, at}`), `admins/{uid}`, `joinCodes/{code}` (`{role}`), `settings/codes` (`{edit, view}`), `blobs/{id}` + `blobs/{id}/parts/{000…}`.
- **Weather**: `SITE.loc={name,lat,lon}` (設定 → 基本資料 → 工地地點: 縣市 + 鄉鎮市區 from `TW_TOWNS`, or GPS; also `city`, `town`, `gps`) turns on automatic weather from Open-Meteo (free tier, no key, non-commercial; `wxLoad` in index.html). Past days are saved in `SITE.wxlog[date]={am,pm,mm,hi,lo}` by anyone who can write; today/tomorrow come from the forecast. A 日報's own weather always wins; days without a report use the log (工地動畫, the 下雨天數 card in 歷史紀錄). New reports are pre-filled from it.
- **Building / 圖說** (設定 → 樓層、圖說): `SITE.floors=[{name,base,top,stage?}]` (heights in cm from the elevation drawing) and `SITE.bLen` (building's long side in m) drive the floor-by-floor building in 工地動畫: footprint = hull of the work zones (`buildingGeo`), each floor follows the 工程階段 of the same name (`floorStage`/`stageOn`; 進行中 = red steel frame, 完成 = grey frame + deck, clad once a stage named 外牆 is done). Stages keep `since`/`doneOn` dates so past days show the building as it was. Crews in the footprint stand on the active floor. Drawn in `drawBuilding` (2D fallback) and `buildBldg` in sim3d.js (3D). 剖開看 (`SIM.cut`, the layers button on 工地): the chosen floor shows its walls cut at ~1.2 m and room names, from `SITE.layout={id,floors}` — a JSON blob `{floors:{<floor name>:{s:[x1,y1,x2,y2,…] cm, t:[[name,x,y],…]}}}` converted from the 完成圖 DXF (y up), fitted onto the footprint by `layoutFit` (mirror, same area, best-overlap rotation). 外觀: the same layout JSON may carry `facade={xr,yr,open1F,roof:{ridgeX},sides:{yn,yp,xp,xn:[[from,to,z0,z1,type],…]}}` (openings measured off the 立面圖, cm); `facadeFit` gives each footprint wall the elevation it faces and sim3d.js draws the windows, open ground floor and cross-ridge roof. `SITE.drawings=[{id,name,set,aspect,pdfId?}]` are blobs grouped by set (建照圖／完成圖／立面圖／其他).
- **Firestore cannot store nested arrays.** Use arrays of objects (e.g. punch `log: [{k:'in', at}]`).
- **Photos and drawings** are stored in Firestore, base64 in 700 KB parts (free Spark plan, no Firebase Storage). `imgSrc({id})` → `BP_WEB.blobSrc(id)`, which returns a placeholder (`…#bp-<id>`) and swaps the real image into every matching `<img>` once loaded.
- **Roles**: admin (in `admins/`), 可編輯 (`edit`), 只能看 (`view`). `USER.can('data.write')` is true for admin and edit. Everyone, including 只能看, may 打卡 for themselves.
- **Joining**: a new user registers with an invite code; the rules let them create only their own `members/{uid}` with that code's role.

## Testing
No network on Claude's side is guaranteed, so test with a fake Firebase: serve the repo with `python3 -m http.server`, set `window.BP_FB_BASE = '/fakefb/'` before backend.js loads, and provide in-memory `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js` there. Check on a 390×844 viewport.
