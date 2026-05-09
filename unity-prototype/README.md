# BOTC Solo Unity Prototype

这是一个 Unity 垂直切片原型，用来验证“Unity 前端 + 当前 JS Core/导出数据”的迁移方向是否值得继续。

## 当前验证内容

- 全屏式背景与顶部 HUD。
- 中心魔典布局。
- 9 人 token 环形摆放。
- 未知身份 token / 已翻开 token + 角色图标。
- 死亡帷幕、reminder、小怀疑值徽章。
- 点击 token 更新底部对话舞台。
- 点击 token、私聊、公聊、提名会写入 `unity_action.json`，由 JS Core 桥接脚本处理后刷新 `unity_viewmodel.json`。
- 白天 / 夜晚 / 提名阶段通过 JS Core 推进，Unity 只做 UI 预览和动作投递。
- 构建版可自启动 JS Core bridge：优先使用随包 `StreamingAssets/BotcJsRuntime/node.exe`，缺失时回退到 PATH 中的 `node`。
- 已接入动态行动表单、Storyteller 队列、剧本手册、角色图标选择器、魔典身份标记和终局反馈。
- 三首 BGM 按阶段切换：
  - 白天公私聊：`When_the_Clock_Stops`
  - 夜间行动：`Where_Shadows_Scratch_Stone`
  - 提名/投票/处决：`Gavel_in_the_Square`

## 打开方式

1. 用 Unity Hub 打开本目录：`unity-prototype`。
2. 等待 Unity 完成首次导入、包解析、授权检查。
3. 点击 Play，`BotcPrototypeBootstrap` 会自动生成原型 UI。

也可以直接运行：

```powershell
.\Open-UnityPrototype.ps1
```

如果 Play Mode 中仍显示旧 UI，先停止 Play，再重新点击 Play；Unity 热重载不会总是清掉旧的运行态对象。

## 构建方式

优先使用图形界面构建，当前这台机器上 batchmode 容易触发 `Unity.Licensing.Client.exe` 崩溃：

1. 用 Unity Editor 正常打开 `unity-prototype`。
2. 等待项目完成导入，确认 Console 没有编译错误。
3. 点击顶部菜单 `BOTC Solo -> Build Windows Prototype`。
4. 输出位置：`../unity-build/BOTC_Unity_Prototype.exe`。

构建入口会先从 Electron 资源源目录同步 Unity Resources：

- `assets/roles/{tb,bmr,snv}/*.png` -> `Assets/Resources/Botc/roles/*.png`
- `assets/ui/*.png` -> `Assets/Resources/Botc/ui/*.png`

也可以手动同步并检查：

```powershell
npm run unity:sync-assets
npm run test:unity-assets
```

命令行构建入口仍保留：

```powershell
& 'C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe' -batchmode -quit -projectPath 'C:\Users\11507\Documents\Playground\unity-prototype' -executeMethod BotcSolo.UnityPrototype.Editor.BotcPrototypeBuild.BuildWindows
```

如果遇到 Unity Package Manager 或 Licensing Client 错误，先关闭 Unity/Hub，重新登录 Unity Hub，再用图形界面菜单构建。

## 数据入口

当前读取：

`Assets/StreamingAssets/unity_viewmodel.json`

当前写入：

`Assets/StreamingAssets/unity_action.json`

JS Core 桥接脚本会维护：

- `Assets/StreamingAssets/unity_state.json`
- `Assets/StreamingAssets/unity_action_result.json`
- `Assets/StreamingAssets/unity_viewmodel.json`

开发 Play Mode 时可以手动启动桥接脚本，再进入 Unity：

```powershell
npm run unity:bridge
```

如果需要手动调试 build 版 bridge，可监听 build 版自己的 StreamingAssets 目录：

```powershell
npm run unity:bridge:build
```

一般用户路径不需要手动运行上述命令。直接启动已构建的 `unity-build/BOTC_Unity_Prototype.exe` 时，Unity 会尝试自动拉起内置 bridge。

最小动作闭环：

1. Unity 点击 token，写入 `select-token` action。
2. `scripts/unity_action_bridge.mjs` 调用 JS Core，更新 `unity_state.json`。
3. 桥接脚本重新导出 `unity_viewmodel.json`。
4. Unity 轮询到文件变化后刷新魔典、时间线、事件日志和底部对话栏。

已接入的 action：

- `select-token`：选择 token，并把选中目标同步给 JS Core。
- `private-chat` / `public-discussion` / `nomination`：白天主要流程。
- `night-action`：调用当前主视角角色的夜间行动接口；MVP 会在缺省参数时自动选择合法目标。
- `day-action`：调用当前主视角角色的白天行动接口。
- `storyteller-action`：处理 pending Storyteller 队列。
- `grimoire-reminder` / `grimoire-mark-role`：编辑魔典标记。
- `script-handbook`：切换剧本手册，并导出角色列表与首夜/其他夜顺序表。

## 状态反馈

Unity 写出 action 后会在顶部 HUD 和底部行动摘要显示同步状态：

- `处理中`：action 已写出，正在等待 JS Core bridge 刷新 viewmodel。
- `已刷新`：`vm.action.lastActionId` 已追上 Unity 刚写出的 action。
- `同步错误`：JS Core bridge 返回错误，错误文本来自 `vm.action.message`。
- `同步超时`：超过 3 秒仍未刷新，通常表示没有通过 `npm run unity:demo` 启动，或手动打开 exe 后没有运行 `npm run unity:bridge:build`。

私聊面板也会显示相同状态；如果 bridge 未运行，不会再一直停留在“等待 JS Core 刷新回复”。

## 一键运行 demo

在仓库根目录运行：

```powershell
npm run unity:demo
```

这会按顺序执行：

1. 用 JS Core 创建一局 fresh demo state。
2. 写入 build 版 `BOTC_Unity_Prototype_Data/StreamingAssets/unity_state.json` 和 `unity_viewmodel.json`。
3. 后台启动 `scripts/unity_action_bridge.mjs --watch`。
4. 启动 `unity-build/BOTC_Unity_Prototype.exe`。

只初始化 Play Mode/project viewmodel、不启动 bridge 和 Unity 窗口：

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch
```

只初始化 build 版 viewmodel、不启动 bridge 和 Unity 窗口：

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -NoWatch -NoLaunch -BuildAssets
```

可玩 demo 闭环验收：

```powershell
npm run test:unity-demo-acceptance
```

该验收会覆盖：

- fresh state 初始化
- token 选择
- 私聊 AI 回复
- 公聊推进
- 提名投票
- 剧本手册
- 真实 JS Core Storyteller 队列：`sage-info`、`ravenkeeper-info`、`barber-swap`

可选参数：

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_unity_demo.ps1 -Fresh -ScriptId tb -Players 9 -Role washerwoman -Seed 20260507
```

## 后续建议

1. 继续做角色专用的行动表单美术控件，让复杂角色不只依赖通用按钮网格。
2. 固化 UI 截图回归，至少覆盖 16:9、窄屏和高 DPI 三类窗口。
3. 把私聊、公聊和投票仪式继续往“底部对话框 + 人物/token 演出”方向打磨。
4. 在规则边界稳定后再集中打磨 AI 对话口吻和长期记忆复盘。
