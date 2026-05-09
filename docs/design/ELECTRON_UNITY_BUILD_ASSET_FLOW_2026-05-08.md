# Electron / Unity Build Asset Flow

日期：2026-05-08

## 结论

Electron 版不会缺 `soldier.png` 这类图，因为 Electron 打包配置把整个 `assets/**/*` 放进 asar。Unity prototype 会缺图，是因为 Unity 只打包 `unity-prototype/Assets/Resources/**`，此前这个目录靠手工拷贝，只有部分 TB 角色图。

## Electron 资源链路

- 构建入口：`package.json` 的 `electron:win`。
- 打包器：`electron-builder`。
- 资源包含规则：`build.files` 包含：
  - `index.html`
  - `styles.css`
  - `assets/**/*`
  - `scripts/**/*`
  - `electron/**/*`
- 角色图来源：`scripts/role_localization.js` 指向 `./assets/roles/<script>/<role>.png`。
- 运行时显示：`scripts/ui.js` 用这些 `role.icon` 路径设置 token / bluff / reminder 背景图。

因此，只要 `assets/roles/tb/soldier.png` 存在，Electron build 就能带上。

## Unity 资源链路

- Unity 运行时加载：`Resources.Load<Texture2D>("Botc/roles/<roleId>")`。
- Unity 必须在构建前拥有：`unity-prototype/Assets/Resources/Botc/roles/<roleId>.png`。
- Unity build 不会自动读取 Electron 的 `assets/roles/**`。

## 本轮修复

新增同步脚本：

```powershell
npm run unity:sync-assets
```

它会把：

- `assets/roles/tb/*.png`
- `assets/roles/bmr/*.png`
- `assets/roles/snv/*.png`
- `assets/ui/*.png`

同步到：

- `unity-prototype/Assets/Resources/Botc/roles/*.png`
- `unity-prototype/Assets/Resources/Botc/ui/*.png`

新增契约：

```powershell
npm run test:unity-assets
```

它会检查 JS Core 三个剧本里的每个角色都有 Unity Resources 角色图，并检查 Unity UI 资源镜像与 Electron UI 源资源同步。

## 构建防线

- `npm test` 已包含 `test:unity-assets`。
- `tools/run_unity_demo.ps1` 启动前会执行 `scripts/sync_unity_assets.mjs`。
- Unity Editor 构建入口 `BOTC Solo/Build Windows Prototype` 会在 `BuildPipeline.BuildPlayer` 前同步 Electron 资源源目录。

## 后续规则

以后新增角色、改名或更新素材时，资源源头仍以 `assets/**` 为准；Unity 只消费同步后的镜像。任何 Unity build 前都应通过 `npm run test:unity-assets`，避免 JS Core 能引用但 Unity 不能显示的缺图 bug。
