# 验证记录（v0.4）

## 环境
- 工作目录：`C:\Users\11507\Documents\Playground`
- 日期：2026-04-21
- Node（内置 runtime）：`C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- Python（内置 runtime）：`C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`

## 本轮验证（CR-2026-04-21-03）
### 1) 语法检查
```powershell
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/engine.js
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/ui.js
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/ai.js
```
结果：通过。

### 2) 规则语义回归（首夜触发）
执行脚本化冒烟验证，覆盖以下断言：
- TB 占卜师（`fortune-teller`）首夜可行动，且首夜有信息回传。
- BMR `Pukka`（`each night*`）首夜不行动（`pukkaPoisonedId` 仍为 `null`）。
- SnV `No Dashii`（`each night*`）首夜不行动（`noDashiiPoisonedIds` 为 0）。
- 玩家命名不再包含 `AI-` 前缀。

结果：通过。

### 3) 打包验证
```powershell
powershell -ExecutionPolicy Bypass -File tools/build_exe.ps1
```
结果：通过。  
输出目录：`C:\Users\11507\Documents\Playground\dist\BOTC-Solo\`  
可执行文件：`C:\Users\11507\Documents\Playground\dist\BOTC-Solo\BOTC-Solo.exe`

## 结论
- “每个夜晚 / 每个夜晚*”首夜判定已按规则分流。
- 运行时主要乱码文案已清理。
- 命名展示改为座位号风格，不再出现 `AI-x`。
- 新版 EXE 已成功生成，可用于实机体验回归。

## 本轮验证（CR-2026-05-04-01）

### 1) AI 证据簿契约回归

```powershell
npm run test:ai-agents
```

结果：通过。
 


覆盖内容：

- 夜间信息会成为私有 evidence。
- 公聊会成为公开 evidence。
- 私聊 evidence 只进入参与者证据簿，不泄露给无关 AI。
- 私聊和玩家发言会被标记为可疑/可污染信息。
- 投票等公开流程 evidence 维持高可信、不可污染。
- 旧 `addAgentObservation(...)` 路径会同步生成标准 evidence。
- evidence 造成的怀疑变化会写入 `beliefTrailByPlayerId`，包含前后分数、实际改变量、原因和证据回指。
- 重复刷新 AI 信念不会无限追加同一批 trail；trail 表示当前信念解释。
- 复盘态 `AI 推理摘要` 会展示 AI 选择、目标选择和最近 trail 明细。

### 2) 全量契约回归

```powershell
npm test
```

结果：通过。

备注：Node 仍提示 `package.json` 未声明 `"type": "module"`，这是既有 warning，不影响本轮测试结果。

## 本轮验证（CR-2026-05-04-03）

### 1) AI 社交契约回归

```powershell
npm run test:ai-agents
```

结果：通过。

覆盖内容：

- 死亡 AI 可以被私聊。
- 死亡 AI 的私聊仍会写入 `private-whisper` observation/evidence。
- 死亡 AI 可以参与公聊。
- 私聊快捷问题已补充身份、身份范围、硬信息、夜间信息等路径。

## 本轮验证（CR-2026-05-04-04）

### 1) AI 公聊报身份节奏回归

```powershell
npm run test:ai-agents
```

结果：通过。

覆盖内容：

- 第一天公聊不会让所有 AI 同时完整公开身份。
- 第一天公聊可以产生“有信息但不完整报身份 / 低信息量范围 / 不建议逼强功能位全跳”等软披露发言。

## 本轮验证（CR-2026-05-04-05）

### 1) AI 压力提名回归

```powershell
npm run test:ai-agents
```

结果：通过。

覆盖内容：

- Day 1 已经发生公聊后，即使证据较低，AI 也能生成压力提名 proposal。
- 压力提名会带 `pressure` 标记和“压力提名”理由。
- AI 自动提名不会选择死亡玩家。
- AI 自动提名仍要求提名者存活。

### 2) 全量回归

```powershell
npm test
```

结果：通过。

备注：Node 仍提示 `package.json` 未声明 `"type": "module"`，这是既有 warning，不影响本轮测试结果。

## 本轮验证（CR-2026-04-21-04）
### 1) 语法检查
```powershell
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/engine.js
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/ui.js
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check scripts/app.js
```
结果：通过。

### 2) `each night*` 关键回归
执行内联脚本验证：
- TB `Fortune Teller` 首夜可行动（`available=true`）。
- TB `Imp` 首夜不可行动（`available=false`）。
- SnV `Pit-Hag` 首夜不触发变形（`pitHagTransforms.length = 0`）。

结果：通过。

### 3) 顺序表接口验证
执行内联脚本验证 `getNightOrderReference(scriptId)`：
- TB：首夜 9 项，其他夜晚 9 项。
- BMR：首夜 5 项，其他夜晚 15 项。
- SnV：首夜 6 项，其他夜晚 15 项。

结果：通过。

### 4) EXE 构建与启动冒烟
```powershell
powershell -ExecutionPolicy Bypass -File tools/build_exe.ps1
```
结果：通过。  
输出目录：`C:\Users\11507\Documents\Playground\dist\BOTC-Solo\`  
可执行文件：`C:\Users\11507\Documents\Playground\dist\BOTC-Solo\BOTC-Solo.exe`

启动冒烟：
- 启动 4 秒后进程仍在运行（未立即崩溃），随后人工结束进程用于验证。

结果：通过。
## 本轮验证（CR-2026-05-07-01）

### 1) 项目契约回归

```powershell
npm test
```

结果：通过。

覆盖：
- role action contracts
- ai agent contracts
- unity viewmodel contracts
- unity action bridge contracts
- mojibake contracts

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

备注：日志中仍有 Unity Licensing token 刷新 warning，但本次构建成功完成，`Assembly-CSharp.dll` 更新时间为 2026-05-07 14:11:57。

### 3) Unity prototype 启动冒烟

```powershell
Start-Process -FilePath 'C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype.exe' `
  -WorkingDirectory 'C:\Users\11507\Documents\Playground\unity-build'
```

结果：通过。启动 6 秒后进程仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 字体与 demo 对齐）

### 1) Bridge 语法检查

```powershell
node --check scripts/unity_action_bridge.mjs
```

结果：通过。

### 2) Unity demo 初始化链路

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch
```

结果：通过。已写入 `unity-prototype/Assets/StreamingAssets/unity_viewmodel.json`。

### 3) Unity demo bridge watch 启动

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoLaunch
```

结果：通过。bridge 进程可启动；验证后已停止测试进程。

### 4) 项目契约回归

```powershell
npm test
```

结果：通过。

### 5) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-demo-align-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-07 14:26:24。

### 6) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity / Electron 主干接入）

### 1) Unity viewmodel 权限契约

```powershell
npm run test:unity-viewmodel
```

结果：通过。

覆盖新增断言：
- 非恶魔主视角不应看到真实恶魔伪装。
- 全知魔典视角可以看到真实恶魔伪装。
- Unity viewmodel 包含阶段目标、行动摘要和私有信息字段。

### 2) Unity action bridge 契约

```powershell
npm run test:unity-action-bridge
```

结果：通过。

### 3) 语法检查

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
```

结果：通过。

### 4) Demo 初始化

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch
```

结果：通过。live `unity_viewmodel.json` 中非恶魔主视角 `bluffs` 为 `未知 / 未知 / 未知`。

### 5) 全量回归

```powershell
npm test
```

结果：通过。

### 6) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-electron-bridge-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-07 14:53:45。

### 7) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 迁移矩阵）

### 1) 语法检查

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
```

结果：通过。

### 2) Unity viewmodel 契约

```powershell
npm run test:unity-viewmodel
```

结果：通过。

新增覆盖：

- 非恶魔主视角不看到真实恶魔伪装。
- 非全知视角不导出非主视角真实身份。
- 全知魔典视角显示真实身份和恶魔伪装。
- Storyteller 队列、复盘、夜晚、私聊、公聊、提名的阶段标题矩阵。
- 夜间/白天/Storyteller 行动文本、提名文本、私聊骗人文本和 AI 复盘摘要字段。

### 3) Unity action bridge 契约

```powershell
npm run test:unity-action-bridge
```

结果：通过。

新增覆盖：

- 私聊骗人 payload：`claimRoleId`、`nightInfo`、`askSecret` 会进入 JS Core 私聊 timeline。
- 白天行动：Slayer demo 可通过 Unity action 写入 `humanDayPlan`。
- Storyteller 队列：Unity `storyteller-action` 可清空 pending queue。

### 4) 全量回归

```powershell
npm test
```

结果：通过。

### 5) Demo 初始化

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch
```

结果：通过。已写入 live `unity_viewmodel.json`。

### 6) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-migration-matrix-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 7) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 迁移矩阵续推进）

### 1) Unity viewmodel 语法与契约

```powershell
node --check scripts/unity_viewmodel.js
npm run test:unity-viewmodel
```

结果：通过。

新增覆盖：

- `actionForms[]` 导出夜间、白天、Storyteller 三类动态表单槽位。
- `voteCeremony` 可从 JS Core 投票事件导出逐人投票数据。
- `aiRecapDetails[]` 导出 AI 目标排序与 evidence trail 摘要。

### 2) Unity action bridge 契约

```powershell
npm run test:unity-action-bridge
```

结果：通过。

新增覆盖：

- Unity `nomination` action 结算后会在 viewmodel 中产生 `voteCeremony`。

### 3) 全量回归

```powershell
npm test
```

结果：通过。

### 4) Demo 初始化

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch
```

结果：通过。

### 5) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-migration-matrix-continued-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 6) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 私聊面板与底部托盘）

### 1) 全量回归

```powershell
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-panel-layout-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 私聊真实控件面板）

### 1) 全量回归

```powershell
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-controls-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 动态行动表单控件）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-action-form-controls-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 轻量 UI Polish）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-polish-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 资料抽屉 Tabs）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-info-tabs-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 行动表单多选）

### 1) 契约回归

```powershell
npm run test:unity-action-bridge
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-action-multiselect-2026-05-07.log'
```

结果：通过。第一次构建发现 C# 匿名类型不一致，修复后重跑通过，日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 投票仪式面板）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-vote-panel-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 资料抽屉视觉打磨）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-info-drawer-polish-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 私聊历史面板）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-history-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 投票逐个举手动画）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-vote-animation-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 底部托盘降噪）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-bottom-dock-declutter-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 常用动作 + 更多动作抽屉）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-more-actions-drawer-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity Token Inspector 独立面板）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-token-inspector-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity 私聊面板视觉定稿）

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-panel-final-2026-05-07.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity UI Roadmap Pass）

覆盖：

- 夜间 / 白天复杂行动表单补齐。
- Storyteller 队列独立面板。
- 剧本手册正式化。
- 投票 token 式仪式镜头。

### 1) 语法与全量回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-next-roadmap-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。

### 3) Unity prototype 启动冒烟

结果：通过。构建版 exe 启动 6 秒后仍在运行；随后为验证清理手动结束进程。Player.log 未见运行时异常。

## 本轮验证补充（Unity playable demo acceptance + UI sync feedback）

覆盖：
- 可玩 demo 闭环：fresh state、选 token、私聊 AI 回复、公聊、提名投票、剧本手册。
- UI 状态反馈：pending、ok、error、bridge timeout 的 Unity 本地状态口径。
- build 版 StreamingAssets 启动路径：`npm run unity:demo` 使用 build 目录并启动 bridge。

### 1) 语法与契约回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
node --check scripts/unity_demo_acceptance.mjs
npm test
```

结果：通过。`npm test` 已包含 `test:unity-demo-acceptance`。

### 2) Unity playable demo acceptance

```powershell
npm run test:unity-demo-acceptance
```

结果：通过。脚本确认：
- 9 人 fresh demo state 导出成功。
- `select-token` 回写选中玩家。
- `private-chat` 生成 AI whisper 回复。
- `public-discussion` 写入 public timeline。
- `nomination` 导出 `voteCeremony.voters[]`。
- `script-handbook` 打开并导出角色数据。

### 3) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-demo-acceptance-status-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`；`Assembly-CSharp.dll` 更新时间为 2026-05-08 10:11。

### 4) Unity build demo 启动冒烟

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。脚本使用 build 版 StreamingAssets，启动 bridge 与 Unity exe；Unity 进程启动 6 秒后仍响应。验证后已停止测试进程，Player.log 未见异常。

## 本轮验证补充（Unity token icon fallback + pending sync polling）

覆盖：
- 角色图标资源缺失时不再显示白色方块，改为暗色圆形占位与角色首字。
- Unity pending action 期间会定时重读 viewmodel，避免文件时间戳边界导致 UI 误报 bridge 超时。

### 1) 语法与验收回归

```powershell
node --check scripts/unity_viewmodel.js
node --check scripts/unity_action_bridge.mjs
npm run test:unity-demo-acceptance
npm test
```

结果：通过。

### 2) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-token-fallback-pending-fix-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`；`Assembly-CSharp.dll` 更新时间为 2026-05-08 10:34。

### 3) Unity build demo 启动冒烟

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。Unity 与 bridge 进程启动 6 秒后仍正常；验证后已停止测试进程，Player.log 未见异常。

## 本轮验证补充（Electron / Unity asset sync guard）

覆盖：
- 阅读 Electron 构建资源链路：Electron build 通过 `package.json build.files` 包含 `assets/**/*`。
- Unity 资源同步防线：`assets/roles/{tb,bmr,snv}` 与 `assets/ui` 同步到 `unity-prototype/Assets/Resources/Botc`。
- 新增 Unity asset contract，避免 JS Core 可引用但 Unity Resources 缺图。
- Unity demo 启动前自动同步资源。
- Unity Editor build 入口在 `BuildPipeline.BuildPlayer` 前自动同步资源。

### 1) Unity asset sync

```powershell
npm run unity:sync-assets
```

结果：通过。首次同步补齐 77 个文件，包括 `soldier.png`、其余 TB 缺失角色图、BMR/SnV 角色图以及 UI 资源。

### 2) 语法与全量回归

```powershell
node --check scripts/sync_unity_assets.mjs
node --check tests/unity_asset_contracts.mjs
npm test
```

结果：通过。`npm test` 已包含 `test:unity-assets`；`test:unity-assets` 输出 `Unity assets are in sync`。

### 3) Unity prototype 构建

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-asset-sync-guard-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`。Unity Resources 当前包含 72 张角色 png。

### 4) Unity build demo 启动冒烟

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。启动脚本先执行资源同步检查，输出 `0 files copied`；Unity 与 bridge 进程启动 6 秒后仍正常。验证后已停止测试进程，Player.log 未见异常。

## 本轮验证补充（Unity playable demo visual QA）
覆盖：
- 底部动作区降噪：6 个常用动作 + 更多动作抽屉。
- 私聊面板、资料抽屉和投票仪式面板视觉空间收束。
- 用户黄金路径：新局、选 token、私聊、公聊、阶段切换、提名投票、剧本手册。

### 1) 契约与 demo 验收
```powershell
npm run test:unity-demo-acceptance
npm test
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-visual-qa-layout-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 13:25:23。Unity licensing / pipe close warning 仍存在，但未阻止构建。

### 3) Unity build demo 启动烟测
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。启动 6 秒后 bridge 与 Unity 进程均仍在运行；验证后已停止测试进程。`C:\Users\11507\AppData\LocalLow\DefaultCompany\unity-prototype\Player.log` 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊交互修正）
覆盖：
- `select-token` 不再占用 Unity pending 状态，避免私聊时仍显示“选中处理中”。
- 私聊阶段点击非主视角 token 自动打开私聊面板。
- Fresh demo 启动清理旧 `unity_action.json` / `unity_action_result.json`，避免继承上一次选中或私聊操作。

### 1) 契约回归
```powershell
npm run test:unity-demo-acceptance
npm test
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-chat-interaction-fix-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 13:44:04。

### 3) Fresh action 清理
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`，确认 fresh 启动不会处理旧 action。

### 4) Unity build demo 启动烟测
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。启动 6 秒后 bridge 与 Unity 进程均仍在运行；验证后已停止测试进程。

## 本轮验证补充（Unity 私聊目标选择层）
覆盖：
- 私聊面板无目标时显示目标选择层，不再显示半可用编辑表单。
- 底部 `私聊` 入口可直接打开目标选择层。
- `询身`、`骗身`、`编夜信`、`保密` 在无目标时也进入同一选择层。

### 1) 契约回归
```powershell
npm run test:unity-demo-acceptance
npm test
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -nographics -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-target-picker-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 14:28:08。

### 3) Unity build demo 启动烟测
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh
```

结果：通过。启动 6 秒后 bridge 与 Unity 进程均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊文本与 BGM 防抖）

覆盖：
- 私聊面板复选框/状态提示排版收束。
- 私聊历史与剧本手册夜晚顺序不再硬省略尾部信息。
- BGM 只在昼/夜/提名仪式 mood 变化或当前 clip 停止时重新播放。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-panel-bgm-text-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 14:54:47。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 文本 Overflow 策略）

覆盖：
- 全局 Unity `Text` 默认纵向截断，不再允许文本画出容器。
- 顶部阶段、最近事件、阶段目标提示增加短区域截断。
- 私聊状态、投票说明、行动表单说明和状态增加明确行数限制。
- 本轮不改变 JS Core action/viewmodel 协议。

### 1) Unity demo 与资源契约
```powershell
npm run test:unity-demo-acceptance
npm run test:unity-assets
npm run test:mojibake
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-text-overflow-strategy-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 21:11:34。

### 3) Fresh build assets smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `Unity asset sync complete. 0 files copied.` 与 `No action file.`。

## 本轮验证补充（Unity 行动表单与剧本手册分页）

覆盖：
- 行动表单目标选项分页，每页 8 项。
- 行动表单身份选项分页，每页 8 项。
- 剧本手册角色列表分页，每页 12 个角色。
- 剧本手册切页自动更新当前详情角色，避免详情与列表页错位。
- fallback 身份来源读取完整剧本角色列表。

### 1) Unity demo 契约与编码
```powershell
npm run test:unity-demo-acceptance
npm run test:mojibake
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-action-handbook-pagination-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 22:33:55。

### 3) Fresh build assets smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `Unity asset sync complete. 0 files copied.` 与 `No action file.`。

### 4) 全量测试
```powershell
npm test
```

结果：通过。

## 本轮验证补充（Unity Token Inspector 目标详情卡）

覆盖：
- Token Inspector 从左下小信息框调整为更清晰的 `目标详情` 卡片。
- 面板正文改为短字段列表，降低底部文字拥挤和 debug 感。
- 快捷操作增加 `行动` 入口，保留 `私聊`、`提名`、`关闭`。
- 未揭示目标只显示未知或魔典标记，不读取真实角色名。
- 本轮未改变 JS Core action/viewmodel 协议。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-token-inspector-card-ui-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 19:47:09。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity HUD 可读性）

覆盖：
- 顶部 HUD 加宽加高后仍可正常渲染。
- `syncStatusPill` 随 normal/pending/error/timeout 状态更新底色。
- 左右侧栏按钮和 token 名牌尺寸调整后不影响 JS Core action。
- 纯 UI 改动不改变 action/viewmodel 协议。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-hud-readability-ui-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 19:30:10。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 模态遮罩与面板层级）

覆盖：
- 私聊、行动表单、Storyteller、剧本手册、投票仪式激活时显示统一暗幕。
- 点击暗幕关闭当前活动大面板。
- 打开大面板前会收起资料抽屉/时间线，避免层级覆盖。
- 遮罩不改变 JS Core action/viewmodel 协议。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-modal-backdrop-ui-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 17:44:56。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊等待气泡）

覆盖：
- 私聊 pending action 绑定当前目标玩家 id。
- 对话区显示等待/超时系统气泡。
- 切换目标时不会显示不匹配目标的 pending 气泡。
- JS Core 完成刷新后清理 pending id、type、player id。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-pending-bubble-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 16:58:03。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊快捷追问）

覆盖：
- 私聊 compose 区新增 4 个快捷追问按钮。
- 快捷追问复用 `private-chat` action，只改变 `text` 与 `intent`。
- 无目标时快捷追问回到私聊目标选择状态。
- compose 区加高后输入框、复选框、状态提示和底部按钮不再共用同一行。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-quick-followups-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 16:44:44。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊气泡化）

覆盖：
- 私聊对话框右侧上半区渲染最近 3 条私聊气泡。
- 玩家发言靠右，对方回复靠左。
- 旧私聊历史文本作为 fallback 保留，不与气泡重叠。
- 私聊 timeline 筛选逻辑由 `PrivateTimelineEntriesForSelected()` 共用。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-dialogue-bubbles-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 16:35:07。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。

## 本轮验证补充（Unity 私聊对话框方向稿）

覆盖：
- 私聊面板改为底部居中大对话框。
- 左侧目标 token 卡在无目标/有目标时均可动态渲染。
- 右侧目标选择层仍能阻止无目标时暴露半可用编辑表单。
- 未揭示目标不会通过卡片读取真实身份。

### 1) 文字编码与 demo 契约
```powershell
npm run test:mojibake
npm run test:unity-demo-acceptance
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-private-dialogue-card-2026-05-08.log'
```

结果：通过。日志包含 `Unity prototype build succeeded`，`Assembly-CSharp.dll` 更新时间为 2026-05-08 16:23:05。

### 3) 全量 JS / Unity 契约
```powershell
npm test
```

结果：通过。

### 4) Fresh build assets 与 build demo smoke
```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

结果：通过。输出 `No action file.`。

补充 smoke：build 版 bridge 与 Unity exe 启动 6 秒后均仍在运行；验证后已停止测试进程。Player.log 未出现 `Exception`、`Error`、`Failed`、`NullReference`。
## 本轮验证补充（Unity bundled Node runtime + role icon picker）

覆盖：
- Windows build 随包携带 `StreamingAssets/BotcJsRuntime/node.exe`。
- Unity standalone 自启动 bridge 时使用随包 `node.exe`，不依赖系统 PATH。
- 角色图标 UI 改动通过 Unity 编译构建。
- JS Core action/viewmodel 契约保持兼容。

### 1) 定向契约
```powershell
npm run test:unity-action-bridge
npm run test:unity-assets
npm run test:mojibake
```

结果：通过。

## 本轮验证补充（Unity marked-role badge + picker context polish）

覆盖：
- 未揭示玩家的魔典身份标记会在主 token 上显示小号角色徽章。
- 角色选择器显示当前目标与当前选择。
- 私聊声称身份 token 容器加大，避免被裁切。
- 免环境 bundled runtime 仍可自启动并处理 action。

### 1) 定向契约
```powershell
npm run test:unity-action-bridge
npm run test:unity-assets
npm run test:mojibake
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-ui-polish-role-badges-2026-05-09.log'
```

结果：通过。

### 3) Demo acceptance 与 bundled runtime smoke
```powershell
npm run test:unity-demo-acceptance
# 仅启动 unity-build/BOTC_Unity_Prototype.exe，确认 UsesBundledNode=True 且 select-token action 返回 ok。
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-bundled-node-role-icons-2026-05-09.log'
```

结果：通过。确认存在：
- `unity-build/BOTC_Unity_Prototype.exe`
- `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsRuntime/node.exe`
- `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs`

### 3) 随包 Node runtime
```powershell
& 'C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsRuntime\node.exe' -v
```

结果：通过，版本为 `v24.15.0`。

### 4) 只启动 exe 的 bundled-runtime smoke
```powershell
# 不手动启动 npm bridge；仅启动 unity-build/BOTC_Unity_Prototype.exe。
# 验证 Unity 拉起的 bridge 命令行包含 BotcJsRuntime\node.exe，
# 再写入 select-token action 并等待 unity_action_result.json 刷新。
```

结果：通过。`UsesBundledNode=True`，smoke action 返回 `ResultOk=True`。

### 5) 全量测试
```powershell
npm test
npm run test:unity-demo-acceptance
```

结果：通过。


## 本轮验证补充（Unity self-start bridge 初步打包）

覆盖：
- Unity Windows build 会把 JS Core 脚本镜像同步进 `StreamingAssets/BotcJsCore`。
- 只启动 `unity-build/BOTC_Unity_Prototype.exe` 时，Unity 会自动启动隐藏 bridge watcher。
- 不手动运行 `npm run unity:bridge:build`，仍能处理 Unity action 并刷新结果。
- 退出验收后测试进程已停止。

### 1) JS Core / Unity 契约
```powershell
npm run test:unity-action-bridge
npm run test:unity-assets
npm run test:mojibake
```

结果：通过。

### 2) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-self-start-bridge-2026-05-09.log'
```

结果：通过。确认存在：
- `unity-build/BOTC_Unity_Prototype.exe`
- `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs`
- `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets/BotcJsCore/package.json`

### 3) build 内 JS Core 镜像
```powershell
$sa='C:\Users\11507\Documents\Playground\unity-build\BOTC_Unity_Prototype_Data\StreamingAssets'
node "$sa\BotcJsCore\scripts\unity_action_bridge.mjs" `
  --state="$sa\unity_state.json" `
  --viewmodel="$sa\unity_viewmodel.json" `
  --action="$sa\unity_action.json" `
  --result="$sa\unity_action_result.json" `
  --fresh
```

结果：通过，输出 `Processed Unity action -> ...unity_viewmodel.json`。

### 4) 只启动 exe 的 self-start smoke
```powershell
# 不手动启动 npm bridge；仅启动 unity-build/BOTC_Unity_Prototype.exe，
# 等待 Unity 自启动 node bridge 后写入 select-token action。
```

结果：通过。smoke action `selfstart-smoke-*` 返回 `ResultOk=True`，消息为 `已选中 1号。`。

### 5) 全量测试
```powershell
npm test
npm run test:unity-demo-acceptance
```

结果：通过。

## 本轮验证补充：Unity 胜负/终局反馈
覆盖：
- JS Core `gameOver/winner/winnerReason` 经 Unity viewmodel 输出为结构化 `outcome`。
- Unity prototype 能读取终局字段，显示终局弹窗和顶部胜利摘要。
- 复盘抽屉在终局后包含胜利阵营、原因和结束时存活/死亡计数。

### 1) Unity viewmodel 终局契约
```powershell
npm run test:unity-viewmodel
```

结果：通过。新增断言覆盖：
- `vm.gameOver === true`
- `vm.winner`
- `vm.winnerReason`
- `vm.outcome.gameOver`
- `vm.outcome.winnerLabel`
- `vm.outcome.finalEvents`

### 2) Unity action bridge 契约
```powershell
npm run test:unity-action-bridge
```

结果：通过。

### 3) Mojibake guard
```powershell
npm run test:mojibake
```

结果：通过。

### 4) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-endgame-feedback-2026-05-09.log'
```

结果：通过。日志包含 `Build Finished, Result: Success.`。

### 5) Demo acceptance / assets
```powershell
npm run test:unity-demo-acceptance
npm run test:unity-assets
```

结果：通过。

### 6) 全量测试
```powershell
npm test
```

结果：通过。

## 本轮验证补充：夜晚行动完整性检查
覆盖：
- TB/BMR/SnV 中 JS Core 已定义的夜晚主动行动规则。
- `getHumanNightActionState`、Unity `humanNightAction`、Unity `night-action` form 和 `setHumanNightActionPlan` 的完整链路。
- BMR Lunatic 的认知恶魔行动、BMR Po 蓄力后的多目标模式。
- Unity build 内随包 JS Core 镜像已包含本轮 `unity_viewmodel.js` 修复。

### 1) 夜晚行动总账契约
```powershell
npm run test:night-actions
```

结果：通过。

### 2) Unity viewmodel / bridge / mojibake
```powershell
npm run test:unity-viewmodel
npm run test:unity-action-bridge
npm run test:mojibake
```

结果：通过。

### 3) 全量测试
```powershell
npm test
```

结果：通过。`npm test` 已包含 `test:night-actions`。

### 4) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-night-action-completeness-2026-05-09.log'
```

结果：通过。日志包含 `Build Finished, Result: Success.`。

### 5) Build 内 JS Core 镜像确认
```powershell
Select-String -Path unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\unity_viewmodel.js `
  -Pattern "options: safeArray\(action\.options\)|roleOptions: safeArray\(action\.roleOptions\)"
```

结果：通过。构建产物中的 `unity_viewmodel.js` 已全量导出 action form options / roleOptions，不再 `.slice(0, 8)`。

### 6) Demo acceptance
```powershell
npm run test:unity-demo-acceptance
```

结果：通过。
## 本轮验证补充：Unity 阶段推进防呆

覆盖：
- `phaseAdvance` viewmodel 字段。
- Storyteller 队列阻断。
- private -> nomination 跳跃阻断。
- public -> nomination 前置公聊轮次检查。
- nomination -> night 前的无人处决确认和下一夜行动检查。
- Unity build 中 JS Core 镜像包含 `unity_phase_guard.mjs`。

### 1) Unity viewmodel / action bridge
```powershell
npm run test:unity-viewmodel
npm run test:unity-action-bridge
```

结果：通过。

### 2) Demo acceptance
```powershell
npm run test:unity-demo-acceptance
```

结果：通过。demo 仍可完成私聊、公聊、进入提名、提名投票和剧本手册打开。

### 3) 全量测试
```powershell
npm test
```

结果：通过。

### 4) Unity prototype 构建
```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' `
  -batchmode -quit `
  -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' `
  -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows `
  -logFile 'C:\Users\11507\Documents\Playground\output\unity-build-phase-guard-2026-05-09.log'
```

结果：通过。日志包含 `Build Finished, Result: Success.`。

### 5) Build 内 JS Core 镜像确认
```powershell
Test-Path 'unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\unity_phase_guard.mjs'
Test-Path 'unity-build\BOTC_Unity_Prototype.exe'
```

结果：均为 `True`。

### 6) Build 内 bridge smoke
```powershell
node 'unity-build\BOTC_Unity_Prototype_Data\StreamingAssets\BotcJsCore\scripts\unity_action_bridge.mjs' `
  --fresh `
  --state='output\build-bridge-phase-guard-smoke\unity_state.json' `
  --out='output\build-bridge-phase-guard-smoke\unity_viewmodel.json' `
  --action='output\build-bridge-phase-guard-smoke\unity_action.json' `
  --result='output\build-bridge-phase-guard-smoke\unity_action_result.json'
```

结果：通过，build 内 bridge 可导出 viewmodel。
