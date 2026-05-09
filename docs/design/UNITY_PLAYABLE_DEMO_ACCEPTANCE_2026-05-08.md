# Unity Playable Demo Acceptance

日期：2026-05-08

## 目标

本轮把 Unity prototype 从“看起来能跑”收束成“可诊断、可验收的可玩 demo”。验收重点不是新增规则，而是确认 Unity build、JS Core bridge、`unity_action.json` 和 `unity_viewmodel.json` 之间形成真实闭环。

## 验收范围

1. 新局初始化：JS Core 创建 fresh state，Unity 读取同一份 StreamingAssets。
2. Token 选择：Unity 写入 `select-token`，bridge 回写选中玩家。
3. 私聊：Unity 写入 `private-chat`，JS Core 生成 AI 回复并写入 timeline。
4. 公聊：Unity 写入 `public-discussion`，JS Core 推进到公聊并写入 public timeline。
5. 提名投票：Unity 写入 nomination，JS Core 导出 `voteCeremony.voters[]`。
6. 剧本手册：Unity 写入 `script-handbook`，viewmodel 打开正式手册。
7. 状态反馈：Unity UI 能区分 pending、成功、错误和 bridge 超时。

## UI 状态口径

- `pending`：Unity 已写出 action，但 `vm.action.lastActionId` 尚未追上本地 action id。
- `ok`：JS Core 已处理 action，并刷新 viewmodel。
- `error`：JS Core 返回错误，Unity 显示 `vm.action.message`。
- `timeout`：pending 超过 3 秒仍未刷新，Unity 提示检查 `npm run unity:demo` 或 `npm run unity:bridge:build`。

## 不在本轮解决

- AI 对话自然度继续放入 backlog。
- 复杂规则边界审计继续放入 backlog。
- Unity 不接管任何规则、权限或 AI 决策。

## 验收命令

```powershell
npm run test:unity-demo-acceptance
node --check scripts\unity_viewmodel.js
node --check scripts\unity_action_bridge.mjs
npm test
```

Unity build 冒烟仍按现有流程运行，build 版 demo 推荐通过：

```powershell
npm run unity:demo
```
