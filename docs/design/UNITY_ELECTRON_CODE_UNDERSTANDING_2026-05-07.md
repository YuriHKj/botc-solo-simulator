# Unity / Electron 接入代码理解（2026-05-07）

## 1. 当前结论

BOTC Solo 目前不是两套游戏逻辑。真实规则、AI、阶段推进、夜间行动、提名投票、私聊公聊、魔典标记都在 Electron/JS Core 主线中；Unity prototype 应该作为表现层消费 JS Core 导出的 viewmodel，并通过 action bridge 把点击/按钮操作回传给 JS Core。

本轮接入原则：

- 不在 Unity 里重写规则。
- 不让 Unity 直接读取全局真相，除非 JS Core viewmodel 明确允许。
- Electron 已有权限口径必须在 `scripts/unity_viewmodel.js` 复用。
- Unity 的按钮只写 `unity_action.json`，由 `scripts/unity_action_bridge.mjs` 修改 JS Core state，再重新导出 viewmodel。

## 2. Electron 主线结构

入口：

- `scripts/app.js`
  - 启动 UI。
  - 持有当前 `state`。
  - 将 UI handler 绑定到 JS Core：新局、私聊、公聊、提名、AI 提名、夜间行动、白天行动、Storyteller 队列、魔典标记、全知视角。

主要 UI：

- `scripts/ui.js`
  - 负责 Electron/HTML 魔典渲染。
  - `renderCircle(...)` 渲染 token。
  - `renderBluffs(...)` 渲染恶魔伪装。
  - `renderNightAction(...)` / `openNightActionModal(...)` 渲染角色行动与 Storyteller 行动。
  - `renderDebateStage(...)` / `renderTimelineRail(...)` 渲染公聊与私聊时间线。
  - `renderLogs(...)` 过滤私有日志，非全知视角只展示主视角可见信息。

规则与状态：

- `scripts/engine.js`
  - `createNewGame(...)` 创建游戏。
  - `runNight(...)` 处理夜晚。
  - `deliverEvilRecognitionFirstNight(...)` 首夜邪恶互认。
  - `getHumanNightActionState(...)` / `setHumanNightActionPlan(...)` 夜间主动行动接口。
  - `getHumanDayActionState(...)` / `setHumanDayActionPlan(...)` 白天主动行动接口。
  - `getPendingStorytellerActionState(...)` / `resolvePendingStorytellerAction(...)` Storyteller 队列接口。
  - `publicRoleLabel(...)` / `publicRoleIcon(...)` 控制角色可见性。

AI：

- `scripts/ai.js` / `scripts/ai_agents.js`
  - 维护 AI observations/evidence。
  - 生成私聊、公聊、提名、投票和复盘 insights。

## 3. Unity 接入层结构

导出：

- `scripts/unity_viewmodel.js`
  - 将 JS Core `state` 转成 Unity 可读 JSON。
  - 当前已导出：玩家、阶段、日志、timeline、action bridge 状态、humanNightAction、humanDayAction、pendingStorytellerAction、scriptHandbook。
  - 这是权限控制边界。Unity 只能展示这里给出的内容。

桥接：

- `scripts/unity_action_bridge.mjs`
  - 读取 `unity_action.json`。
  - 调用 JS Core handler：`private-chat`、`public-discussion`、`nomination`、`night-action`、`day-action`、`storyteller-action`、`grimoire-reminder`、`grimoire-mark-role`、`script-handbook`、`toggle-grimoire`、`new-game`。
  - 持久化 `unity_state.json` 并重写 `unity_viewmodel.json`。

Unity 视觉：

- `unity-prototype/Assets/Scripts/BotcPrototypeBootstrap.cs`
  - 运行时生成 Canvas UI。
  - 读取 `StreamingAssets/unity_viewmodel.json`。
  - 写入 `StreamingAssets/unity_action.json`。
  - 当前是原型单文件 UI，不应承载规则。

运行 demo：

- `tools/run_unity_demo.ps1`
  - fresh 初始化 JS Core 状态。
  - 启动 action bridge watch。
  - 启动 Unity 构建版 exe。

## 4. 发现的问题：恶魔伪装泄露

Electron 侧正确逻辑在 `scripts/ui.js`：

```js
const human = state.players.find((entry) => entry.isHuman);
const canReveal = state.grimoireView || human?.category === "demon";
const bluffs = canReveal ? state.demonBluffs : [
  { name: "未知", icon: null },
  { name: "未知", icon: null },
  { name: "未知", icon: null },
];
```

Unity 导出层当前问题：

```js
function buildBluffs(state) {
  return safeArray(state?.demonBluffs)
    .slice(0, 3)
    .map((entry) => entry?.name ?? entry?.id ?? "未知");
}
```

因此主视角是洗衣妇、图书管理员等非恶魔角色时，Unity 仍然看到真实恶魔伪装。修复应在 `scripts/unity_viewmodel.js`，而不是 Unity C#，因为权限边界必须在导出层。

## 5. Electron 内容接入优先级

### 已具备 JS Core 数据/动作接口，应该优先接入 Unity

1. 恶魔伪装权限：
   - 非恶魔、非全知：显示 `未知 / 未知 / 未知`。
   - 恶魔或全知：显示真实 bluffs。

2. 行动状态：
   - `action.status/message/selectedPlayerName`
   - `humanNightAction`
   - `humanDayAction`
   - `pendingStorytellerAction`

3. 日志/私有信息：
   - 使用 `unity_viewmodel.events`，由 JS 导出层过滤可见性。

4. 时间线：
   - 使用 `unity_viewmodel.timeline` 展示公聊/私聊。

5. Storyteller 队列：
   - 使用 `storytellerQueue` 和 `pendingStorytellerAction`。

6. 剧本手册：
   - 使用 `scriptHandbook`，由 `script-handbook` action 切换。

### 后续再做的复杂 UI

- Electron 私聊“骗人接口”的完整按钮组和输入框。
- 动态夜间行动表单的每一种 inputType 可视化。
- 投票逐个举手动画。
- AI 证据簿完整复盘 UI。
- 设置页、存档读档和多剧本新局菜单。

## 6. 本轮建议实施

最小安全增量：

1. 修复 `buildBluffs(...)` 权限。
2. 给 Unity viewmodel 增加：
   - `phaseObjectiveTitle`
   - `phaseObjectiveHint`
   - `actionSummary`
   - `privateInfo`
3. Unity bottom dock 展示 action summary 和当前可用行动。
4. Unity 增加按钮：
   - Storyteller
   - 白天行动
   - 全知切换
   - 新局
5. 增加/更新 contract test，覆盖非恶魔不泄露 bluffs。

这样 Unity 会更像 Electron 的前端镜像，同时保持规则和权限仍由 JS Core 控制。
