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
