# BOTC Solo Simulator 线程交接记忆文档

更新时间：2026-05-07  
工作目录：`C:\Users\11507\Documents\Playground`

这份文档用于在新 Codex 线程中快速恢复上下文。当前线程非常长，已经包含 Electron 原型、AI agent、角色接口、Unity 原型、打包、乱码、素材、交互流程等大量历史。新线程建议优先阅读本文件，再按“新线程启动建议”继续。

## 1. 项目总目标

开发一款单机版《血染钟楼》模拟器，目标形态是可运行的 Windows `.exe`。核心要求包括：

- 有类似官方魔典的中心化 grimoire/token UI。
- 电脑玩家不是乱说话，而是基于自身可见信息、公开发言、私聊、夜间信息、投票/提名等 observation 推理。
- 每局初设有随机性，也允许开局自选主视角角色用于测试。
- 先覆盖官方三剧本：暗流涌动 TB、黯月初升 BMR、梦殒春宵 SnV。
- 长期方向：角色接口可独立组合，不绑定剧本，方便未来自定义剧本。
- 目前正在尝试从 Electron/HTML 视觉层迁移或桥接到 Unity 视觉层，但 JS Core 暂时仍是规则和 AI 主核心。

## 2. 当前代码分层

### 2.1 Electron/HTML 主线

这是功能最完整的一条线，包含规则、AI、角色接口、证据簿、对话、音频、打包等主要逻辑。

关键文件：

- `C:\Users\11507\Documents\Playground\index.html`
- `C:\Users\11507\Documents\Playground\styles.css`
- `C:\Users\11507\Documents\Playground\scripts\app.js`
- `C:\Users\11507\Documents\Playground\scripts\engine.js`
- `C:\Users\11507\Documents\Playground\scripts\ui.js`
- `C:\Users\11507\Documents\Playground\scripts\ai.js`
- `C:\Users\11507\Documents\Playground\scripts\ai_agents.js`
- `C:\Users\11507\Documents\Playground\scripts\ai_speech_corpus.json`
- `C:\Users\11507\Documents\Playground\scripts\audio.js`
- `C:\Users\11507\Documents\Playground\scripts\roles\tb.js`
- `C:\Users\11507\Documents\Playground\scripts\roles\bmr.js`
- `C:\Users\11507\Documents\Playground\scripts\roles\snv.js`
- `C:\Users\11507\Documents\Playground\electron\main.cjs`
- `C:\Users\11507\Documents\Playground\electron\preload.cjs`

### 2.2 JS Core -> Unity 桥接层

目标是让 Electron/JS Core 输出一个 `unity_viewmodel.json`，Unity 只负责消费视图数据和回传 action。

关键文件：

- `C:\Users\11507\Documents\Playground\scripts\unity_viewmodel.js`
- `C:\Users\11507\Documents\Playground\scripts\export_unity_viewmodel.mjs`
- `C:\Users\11507\Documents\Playground\scripts\unity_action_bridge.mjs`
- `C:\Users\11507\Documents\Playground\tests\unity_viewmodel_contracts.mjs`
- `C:\Users\11507\Documents\Playground\tests\unity_action_bridge_contracts.mjs`

当前 package scripts：

```powershell
npm run export:unity-viewmodel
npm run unity:bridge
npm run test:unity-viewmodel
npm run test:unity-action-bridge
```

### 2.3 Unity 原型

Unity 目前是“可运行、可打包的视觉原型”，不是完整替代品。它已经能读取/展示 viewmodel 的大部分信息，并通过 action 协议方向继续接入 JS Core。

关键文件：

- `C:\Users\11507\Documents\Playground\unity-prototype\Assets\Scripts\BotcPrototypeBootstrap.cs`
- `C:\Users\11507\Documents\Playground\unity-prototype\Assets\Editor\BotcPrototypeBuild.cs`
- `C:\Users\11507\Documents\Playground\unity-prototype\Assets\StreamingAssets\sample_viewmodel.json`
- `C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe`

Unity 当前状态：

- Unity Editor 已安装在 `C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe`。
- Unity 授权曾卡在 `Unity.Licensing.Client.exe`，用户重启后恢复。
- `--showEntitlements` 能显示 Unity Personal 授权。
- batchmode 构建已成功。
- 最新构建日志：`C:\Users\11507\Documents\Playground\output\unity-build-after-entitlements.log`
- 构建产物中 `BOTC_Unity_Prototype_Data\Managed\Assembly-CSharp.dll` 已在 2026-05-07 更新，说明不是旧包。
- 运行过构建 exe，进程正常，Player.log 无明显运行时异常。

Unity 构建命令：

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-after-entitlements.log'
```

Unity 运行命令：

```powershell
Start-Process -FilePath 'C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe' `
  -WorkingDirectory 'C:\Users\11507\Documents\Playground\unity-build'
```

## 3. 当前已完成的重要工作

### 3.1 UI 与视觉

Electron 版已经做过多轮 UI 改造：

- 由早期侧边栏/底部框过多，逐渐改向中心魔典化。
- token 使用 `vote1`、`token1 + 角色图标`、`shroud1`、reminder 底版等官方素材风格。
- 支持 token 点击、右键/快捷菜单、添加/删除 reminder 的方向。
- 底部对话舞台曾被做成可收起/更轻量，但用户多次反馈不要挤占魔典。
- 事件日志和 AI 推理摘要曾在右侧，但后续方向是对局内弱化/收起，复盘再展示 AI 推理摘要。
- 加入阶段 BGM：白天/私聊公聊、夜间、提名投票处决。

Unity 版视觉当前状态：

- 能展示中心魔典、token、reminder/bluff、事件日志、时间线、底部对话舞台、侧边阶段按钮、顶部 HUD。
- 视觉仍然不够像正式游戏，按钮仍偏硬矩形，侧边按钮曾从单字改为完整标签，但还需图标化和更精致装饰。
- 用户参考目标包括 Demon Bluff 的启动界面/游戏内界面，以及官方魔典截图。
- 最新 UI 调整方向：
  - 顶部 HUD 更窄、更轻。
  - 中心魔典更大，占据主视觉。
  - 左右面板减少框线，改为可呼出层。
  - 侧边按钮改成图标/标签组合，不要单字硬按钮。
  - 底部对话栏默认收起或保持非常低矮，不要挡住 grimoire。

### 3.2 角色接口

已经开始做底层大拆，把角色动作从剧本绑定中抽出来：

- 角色不应绑定剧本，未来可自由组合成新剧本。
- 不同角色有不同 action schema，例如：
  - 选玩家。
  - 选玩家 + 角色。
  - 是/否问题。
  - 多组猜测。
  - 多刀/蓄力。
  - 不行动。
  - 信息展示。
- 夜间行动区分：
  - `each night`：首夜也行动。
  - `each night*`：首夜不行动。
- 已修正或至少开始修正 Drunk / Lunatic 这类“认知覆盖”角色：它们不知道自己真实底牌，会按照认知角色行动。
- TB 的若干官方级信息风格已经开始做，比如调查员中毒醉酒时常给“两个善良玩家中有一个爪牙”的伪信息形式。

仍需继续：

- BMR/SnV 复杂规则远未完全官方级。
- 死亡触发、复活、保护、多杀、换角、异常胜负条件仍需要系统性补完和测试。
- 每个角色都应拥有独立的 UI spec/action schema/resolve function。

### 3.3 Storyteller 队列

已经做了 `pendingStorytellerActions` 队列，用于把需要玩家或说书人处理的夜间/特殊行动挂起。

已覆盖方向：

- 夜间角色行动需要弹窗选择目标。
- 死亡触发角色加入队列。
- 特殊触发角色可统一进入 Storyteller UI。
- Unity action 协议也在接这个方向。

已有或提到的角色触发包括：

- Ravenkeeper
- Moonchild
- Klutz
- Barber
- Sage
- Professor
- Snake Charmer
- Slayer

下一步需要让 Storyteller 队列 UI 更专用化：

- 每种 action 类型都有对应视觉和确认步骤。
- 需要在夜间流程中像真实说书人叫醒角色一样展示。
- 确认夜间信息是否已展示给主视角，也要通过队列控制。

### 3.4 AI Agent / Observation / Evidence

这条线已经推进很多，是项目核心。

已做方向：

- 将公聊、私聊、夜间信息、投票、提名转成 per-agent observations。
- AI 不应读全局真相，而是只根据自身 observation 推理。
- 引入证据簿思路：每次怀疑值变化记录由哪些 evidence 导致。
- trail 已接入复盘 UI 的方向。
- 增加 AI -> AI 私聊和 observation 写入。
- 增加 dayStanceMemory。
- 增加自动提名压力逻辑。
- 扩充私聊次数：day1 最多 5 次，每日递减；一次私聊内追问不消耗次数，但追问有上限。
- 死人可以聊天。
- 公聊报身份节奏优化：不是所有 AI 第一天默认交身份。
- 外来者声明、邪恶方伪装策略受剧本中角色影响，例如教父、方古等影响外来者声明/伪装。
- 私聊按钮化问法 + 自由输入补充。
- 做过 persona 语料库，抽取复盘里的真实好句子，让不同 AI 说话风格更分化。

仍然存在的问题：

- AI 发言仍可能显得模板化，或者过度理性，不够像真人。
- 私聊里邪恶队友不交信息、间谍对蓝交真信息等问题暴露出底层“身份/阵营/信息可分享策略”仍需翻新。
- AI 主动私聊主视角的策略还不够成熟。
- AI 死后有时不交身份，导致局势不推进。
- 公聊时间线展示和阶段化辩论仍需完善。
- 用户希望加入“主视角对外骗人接口”：私下声称身份、编夜间信息、要求保密。

### 3.5 语言/乱码

有过严重乱码问题，特别是事件日志里出现中文 mojibake。

已经做过：

- 增加 `.editorconfig`。
- 增加 `tests/mojibake_contracts.mjs`。
- `npm test` 包含 mojibake 测试。
- 通过 Node JSON.stringify 验证过部分源文件实际是 UTF-8，PowerShell `Get-Content` 有时显示乱码是终端编码问题，不一定是文件真的坏。

需要注意：

- 看到乱码时先区分“运行界面真的乱码”还是“PowerShell 输出乱码”。
- 写中文文件建议明确 UTF-8。
- Unity C# 文件里的中文也需要注意编码，若 Unity UI 文字乱码，优先检查字体是否支持中文、Text 组件字体资源、文件编码。

### 3.6 打包与运行

Electron：

```powershell
npm run electron:win
```

Unity：见上方 Unity 构建命令。

测试：

```powershell
npm test
```

当前 `package.json` 测试链包含：

- `test:role-actions`
- `test:ai-agents`
- `test:unity-viewmodel`
- `test:unity-action-bridge`
- `test:mojibake`

## 4. 当前工作区状态提醒

当前 git 工作区是脏的，有大量未提交改动和未跟踪文件。新线程务必不要使用：

```powershell
git reset --hard
git checkout -- .
```

除非用户明确要求，否则不要清空这些改动。

当前已知未提交/未跟踪方向包括：

- Electron 主线文件修改。
- `scripts/ai*`、`scripts/app.js`、`scripts/engine.js`、`scripts/ui.js` 修改。
- BMR/SnV 角色文件修改。
- Unity viewmodel/action bridge 新文件。
- Unity 原型工程和 build 产物。
- BGM mp3 文件。
- AI/Unity/设计文档。
- 测试文件。

新线程开始时建议先运行：

```powershell
git status --short
npm test
```

如果要继续 Unity UI：

```powershell
Start-Process -FilePath 'C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe' -WorkingDirectory 'C:\Users\11507\Documents\Playground\unity-build'
```

## 5. 最近 Unity 授权/打包坑

曾出现问题：

- `Unity.Licensing.Client.exe` 应用程序错误。
- batchmode 报 `No valid Unity Editor license found`。
- `taskkill /F /IM Unity.Licensing.Client.exe` 普通权限拒绝访问。
- 管理员 PowerShell 也只能杀掉部分残留进程。

解决过程：

1. 用户重启电脑。
2. 确认无 Unity/Licensing 残留进程。
3. 运行 Unity Licensing Client 的 `--showEntitlements`，确认 Unity Personal 授权存在。
4. 再跑 Unity batchmode build，成功。

检查授权命令：

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Data\Resources\Licensing\Client\Unity.Licensing.Client.exe' --showEntitlements
```

如果后续又卡授权，先不要改项目代码，先解决 Unity Hub/License 进程。

## 6. 用户近期明确偏好

UI：

- 不希望侧边栏和底部面板占据大量空间。
- 希望中心魔典是主画面。
- 希望更接近官方魔典和 Demon Bluff 的游戏感。
- 不喜欢单字按钮和硬矩形按钮，想要更正式、更装饰性的按钮。
- 需要能在对话时随时查看魔典，不要弹窗突脸遮挡关键信息。
- 希望阶段、公聊、私聊、提名、投票有动画和时序。

AI：

- 不希望 AI 正则匹配式回答。
- 不打算走服务器/LLM 训练路线，但可以用本地语料、模板变体、persona、证据簿来提升自然度。
- AI 应该像独立玩家，不能有全视角。
- 邪恶方知道的信息要互通，但不能随便对善良方暴露。
- 死人也应该能聊天并在合适时交身份推进局势。
- AI 主动私聊主视角很重要。

规则：

- 首夜邪恶方互认必须实现：恶魔知道爪牙和 3 个不在场伪装；爪牙知道恶魔和其他爪牙，但不一定知道具体角色。
- 自己一定能看到自己的角色。
- Drunk/Lunatic 等认知覆盖角色要按认知角色行动，而不是知道真实身份。
- `each night` 和 `each night*` 区分必须正确。

## 7. 建议新线程的优先路线

### 路线 A：继续 Unity 视觉原型

适合用户想优先看画面。

1. 运行 Unity exe，要求用户发截图。
2. 修改 `BotcPrototypeBootstrap.cs`：
   - 顶部 HUD 更像官方魔典，减少横条高度。
   - 中心 grimoire 扩大，token 不拥挤。
   - 左右面板默认收起，只在点击“事件/时间线/资料”时展开。
   - 侧边按钮换成图标 + 标签，不用单字硬按钮。
   - 底部对话栏默认收起或降低高度。
   - 主菜单做成更完整的首页，而不是简单弹窗。
3. batchmode 构建。
4. 运行检查 Player.log。

### 路线 B：继续 JS Core/AI/规则

适合用户想优先解决玩法。

1. 读 `血染钟楼Agent介绍文档.md` 和 `docs/复盘2.txt`。
2. 检查 AI 为什么会泄露阵营/真实信息。
3. 重构 private/public claim strategy：
   - 善良方何时交身份。
   - 邪恶方对善良方撒谎。
   - 邪恶队友之间共享真实信息。
   - 死人何时交身份。
4. 完善“主视角骗人接口”：
   - 私聊声称身份。
   - 私聊编夜间信息。
   - 要求对方保密。
   - 公聊身份范围声明。
5. 增加 AI 主动私聊策略和白天阶段化辩论。

### 路线 C：角色接口官方级细则

适合用户想先补规则准确性。

1. 继续拆 `scripts/roles/tb.js` / `bmr.js` / `snv.js`。
2. 每个角色独立 schema + action UI spec + resolve function。
3. 完成 TB 官方级细则，再扩 BMR/SnV。
4. 为每个复杂角色增加 contract test。

## 8. 新线程启动建议 Prompt

可以直接把下面这段发给新线程：

```text
请先阅读 C:\Users\11507\Documents\Playground\docs\THREAD_HANDOFF_2026-05-07.md，恢复 BOTC Solo Simulator 项目上下文。不要 reset 或清理未提交改动。当前主要有 Electron/JS Core 和 Unity prototype 两条线：JS Core 是规则和 AI 主核心，Unity 正在做视觉层原型。请先运行 git status --short 和 npm test，然后根据我接下来的要求继续开发。
```

如果要继续 Unity：

```text
请基于交接文档继续 Unity prototype。先运行 C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe 做视觉检查，再继续把顶部 HUD、左右面板、中心魔典和按钮改得更像官方魔典/Demon Bluff。不要破坏 JS Core。
```

如果要继续 AI：

```text
请基于交接文档继续 AI agent。重点检查 AI 是否仍在读取全局真相、是否错误泄露邪恶信息，并完善 observation/evidence/persona/claim strategy，让 AI 更像独立玩家。
```

## 9. 最后一句给下一线程

这个项目已经不是单个 demo，而是一个正在分层重构的复杂单机游戏原型。继续工作时最重要的不是“重写一遍”，而是保护已有积累：JS Core 的规则和 AI、Electron 的完整交互、Unity 的视觉验证、tests 的契约，都要作为现有资产继续推进。任何大改都应该先定位当前接口，再小步替换。
