# Windows EXE 打包说明（BOTC-Solo 目录版）

## 当前已产出
- 目录版：`dist/BOTC-Solo/`

## 一键重建
```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build_exe.ps1
```

## 手动步骤

1. 安装打包依赖
```powershell
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pip install --upgrade pyinstaller pywebview
```

2. 构建 BOTC-Solo（目录版）
```powershell
C:\Users\11507\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Scripts\pyinstaller.exe --noconfirm --clean --windowed --name BOTC-Solo --add-data "index.html;." --add-data "styles.css;." --add-data "scripts;scripts" --add-data "assets;assets" desktop_launcher.py
```

## 运行原理
- `desktop_launcher.py` 会在本地启动内置 HTTP 服务（127.0.0.1 随机端口）。
- 桌面窗口使用 WebView2 渲染本地 `index.html`，不依赖外网。
- 游戏所有核心内容（HTML/CSS/JS/素材）都随 BOTC-Solo 目录版一起分发。

## 兼容性
- 需要 Windows WebView2 运行时（Windows 11 通常已内置）。
- 未做代码签名，首次运行可能出现安全提示。

## 备注
- 项目里保留了 Electron 配置作为备选路线，但当前主线版本为 PyInstaller 目录版 `BOTC-Solo`。
