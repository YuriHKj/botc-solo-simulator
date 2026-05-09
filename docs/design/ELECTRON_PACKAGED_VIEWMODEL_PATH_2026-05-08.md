# Electron Packaged Viewmodel Path

日期：2026-05-08

## 结论

Electron 开发态可以把 Unity viewmodel 写到源码目录的 `unity-prototype/Assets/StreamingAssets/unity_viewmodel.json`，方便 Unity Editor 直接读取。

Electron 打包态不能继续写这个路径：`app.getAppPath()` 可能指向 `resources/app.asar`，asar 不可写，也不应该承载运行时状态文件。因此打包态必须改写到用户数据目录。

## 路径规则

`electron/path_helpers.cjs` 是 Electron 写出 Unity viewmodel 的唯一路径解析入口：

- 如果设置了 `BOTC_UNITY_VIEWMODEL_PATH`，优先写这个显式路径。
- 如果 `app.getAppPath()` 不是 asar 路径，按开发态写到源码 `unity-prototype/Assets/StreamingAssets/unity_viewmodel.json`。
- 如果 `app.getAppPath()` 位于 `app.asar`，按打包态写到 `app.getPath("userData")/unity/unity_viewmodel.json`。

## 和 Unity demo 的关系

当前可玩 Unity demo 仍以 `scripts/unity_action_bridge.mjs` 为主链路：

- Unity Editor 默认读取 `unity-prototype/Assets/StreamingAssets`。
- Unity build demo 默认读取 `unity-build/BOTC_Unity_Prototype_Data/StreamingAssets`。
- Electron 的 `botc:write-unity-viewmodel` 更偏向开发调试和未来 Electron 启动 Unity 外壳时的导出入口。

因此路径规则的目标不是让 Electron 直接替代 bridge，而是避免 Electron 打包后写入 `app.asar` 或源码路径失败。

## 验证

`npm run test:electron-build` 覆盖：

- Electron 主入口仍是 `electron/main.cjs`。
- `electron-builder` 仍开启 asar。
- `electron:pack` 仍是快速 unpacked build 入口：`electron-builder --win --dir`。
- `build.files` 仍包含 `index.html`、`styles.css`、`assets/**/*`、`scripts/**/*` 和 `electron/**/*`。
- packaged Electron 需要的 `electron/main.cjs`、`electron/preload.cjs`、`electron/path_helpers.cjs` 都存在。

`npm run test:electron-paths` 覆盖：

- asar 路径识别。
- 开发态输出到源码 StreamingAssets。
- 打包态输出到 userData。
- `BOTC_UNITY_VIEWMODEL_PATH` 显式覆盖。

`npm test` 已包含该契约。

## 本轮验证

2026-05-08 已执行：

- `node --check electron/main.cjs`
- `node --check electron/path_helpers.cjs`
- `node --check tests/electron_build_contracts.cjs`
- `node --check tests/electron_path_contracts.cjs`
- `npm run test:electron-build`
- `npm run test:electron-paths`
- `npm run electron:pack`
- `npx asar list release/win-unpacked/resources/app.asar`
- packaged Electron smoke：启动 `release/win-unpacked/BOTC Solo Simulator.exe` 6 秒后仍在运行，随后结束测试进程。
- `npm test`

结果均通过；`app.asar` 中确认存在 `electron/path_helpers.cjs`、`electron/preload.cjs`、`scripts/unity_viewmodel.js`、`scripts/unity_action_bridge.mjs` 和 `assets/roles/tb/soldier.png`。packaged Electron 进程启动 6 秒后仍在运行。`npm test` 同时确认 Unity viewmodel、action bridge、asset sync、demo acceptance 和 mojibake 契约仍然通过。
