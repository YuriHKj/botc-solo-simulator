# Unity 自启动 Bridge 初步打包

## 目标

用户启动 `unity-build/BOTC_Unity_Prototype.exe` 后，Unity 版 demo 应自动启动 JS Core bridge watcher，不需要再手动运行：

```powershell
npm run unity:bridge:build
```

本轮是初步打包，不做单文件发行，也不内嵌 Node runtime。目标机器仍需要 `node` 在 `PATH` 中可用。

## 当前数据流

- Unity 写入：`Application.streamingAssetsPath/unity_action.json`
- JS Core bridge 读取 action，更新：
  - `unity_state.json`
  - `unity_viewmodel.json`
  - `unity_action_result.json`
- Unity 轮询 `unity_viewmodel.json` 刷新 UI。

## 方案

1. 构建前同步 JS Core 脚本镜像：
   - 源：repo 根目录 `scripts/**/*.js`、`scripts/**/*.mjs`、`scripts/**/*.json`
   - 目标：`unity-prototype/Assets/StreamingAssets/BotcJsCore/scripts`
   - 额外写入：`unity-prototype/Assets/StreamingAssets/BotcJsCore/package.json`

2. Unity 启动时自动寻找 bridge：
   - 优先：`StreamingAssets/BotcJsCore/scripts/unity_action_bridge.mjs`
   - 兼容：repo 根目录 `scripts/unity_action_bridge.mjs`

3. Unity 启动 bridge watcher：
   - `node <bridge> --watch --state=<StreamingAssets/unity_state.json> --viewmodel=<StreamingAssets/unity_viewmodel.json> --action=<StreamingAssets/unity_action.json> --result=<StreamingAssets/unity_action_result.json>`

4. 生命周期：
   - Unity 只管理自己启动的 bridge 进程。
   - `OnApplicationQuit()` / `OnDestroy()` 尝试关闭 bridge。

## 边界

- 不改变 action/viewmodel 协议。
- 不改变 JS Core 规则、AI、状态结算逻辑。
- 不杀掉用户手动启动的其他 bridge 进程。
- 不保证没有安装 Node 的机器可运行；这是后续发行包工作。

## 验证

- `node <StreamingAssets mirror>/scripts/unity_action_bridge.mjs --fresh ...`
- Unity batch build。
- 只启动 `unity-build/BOTC_Unity_Prototype.exe`，确认：
  - bridge 自动写入/更新 `unity_viewmodel.json`
  - Unity 操作 private-chat 后 action 被处理
  - 不需要另开 `npm run unity:bridge:build`

## 实施结果

- `scripts/unity_action_bridge.mjs --watch` 启动时会先执行一次初始化输出，保证只有 exe 启动时也能生成 `unity_state.json` / `unity_viewmodel.json`。
- `BotcPrototypeBuild.BuildWindows()` 会在打包前同步 JS Core 脚本镜像到 `Assets/StreamingAssets/BotcJsCore/scripts`，并写入最小 `package.json`。
- `BotcPrototypeBootstrap` 在 standalone 启动时自动拉起隐藏的 `node <mirror>/unity_action_bridge.mjs --watch`，退出时只关闭自己启动的进程。
- 构建时会把 `node.exe` 同步到 `StreamingAssets/BotcJsRuntime/node.exe`；standalone 运行时优先使用该内置 runtime。
- 如果内置 runtime 缺失，Unity 仍会回退到 PATH 中的 `node`，便于开发期排查；正式 build 验收以随包 runtime 为准。

## 本轮验证记录

- `npm run test:unity-action-bridge`：通过。
- `npm run test:unity-assets`：通过。
- `npm run test:mojibake`：通过。
- Unity Windows build：通过，输出到 `unity-build/BOTC_Unity_Prototype.exe`。
- build 内镜像 bridge one-shot：通过。
- 只启动 `unity-build/BOTC_Unity_Prototype.exe` 的 smoke：通过；Unity 自启动 bridge 并处理 `select-token` action。
- `npm test`：通过。
- `npm run test:unity-demo-acceptance`：通过。

## 免环境打包补充

- `BotcPrototypeBuild.BuildWindows()` 现在会查找构建环境中的 `node.exe`，复制到 `Assets/StreamingAssets/BotcJsRuntime/node.exe`。
- 查找顺序：`BOTC_NODE_EXE` 环境变量优先，其次遍历 `PATH`。
- 找不到 `node.exe` 时构建失败，避免产出一个仍需用户手动安装 Node 的包。
- 运行时 `BotcPrototypeBootstrap` 优先使用 `Application.streamingAssetsPath/BotcJsRuntime/node.exe` 启动 bridge。
- 验证 smoke 已确认 Unity 自启动 bridge 的进程命令行使用 `BotcJsRuntime/node.exe`，不是系统 PATH 中的 node。
