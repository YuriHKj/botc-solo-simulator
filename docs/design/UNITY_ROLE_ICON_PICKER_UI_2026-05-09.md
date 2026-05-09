# Unity 角色图标选择 UI

## 目标

Unity 版继续向官方魔典的角色选择体验靠近：身份相关操作尽量使用角色 token 图标，而不是纯文字按钮。

本轮覆盖：
- 剧本手册角色图鉴。
- 私聊声称身份。
- 行动表单中的身份选择。
- 选中玩家的魔典身份标记。

## 设计

- 复用 `Resources/Botc/roles/<roleId>.png` 和 `Botc/ui/token1`，不新增素材协议。
- 新增统一 `AddRoleTokenButton()`：
  - token 底图使用现有羊皮纸圆 token。
  - 中间显示角色图标。
  - 外圈按阵营着色：好人蓝、邪恶红、当前选中金色。
  - 图标缺失时显示角色名首字 fallback。
- 新增 `Role Picker Panel`：
  - 中央大面板，网格展示当前剧本全部角色。
  - 用于“私聊声称身份”和“魔典标记身份”两个上下文。
  - “不声称/清除”也作为一个 token 入口，避免另起一套按钮语义。

## 行为边界

- 不改变 JS Core action/viewmodel 协议。
- 私聊仍发送既有 `private-chat` action，并通过 `claimRoleId` 表达声称身份。
- 魔典标记仍发送既有 `grimoire-mark-role` action，并通过 `roleId` 表达玩家标记。
- 未揭示玩家不会通过 UI 读取真实身份；标记只显示玩家认知中的 `markedRoleId/markedRoleName`。

## 验证

- Unity Windows build：通过。
- `npm test`：通过。
- `npm run test:unity-demo-acceptance`：通过。
- self-start smoke：通过，随包 `BotcJsRuntime/node.exe` 成功驱动 JS Core bridge。

## 追加优化

- 未揭示玩家存在 `markedRoleId` 时，主魔典 token 右下显示小号角色徽章和“标”提示。
- 角色选择器顶部状态显示当前目标和当前选择，降低“打开后不知道在改谁”的误操作风险。
- 私聊声称身份的小 token 容器加大，避免 42px token 在右侧 compose 区被裁切。
