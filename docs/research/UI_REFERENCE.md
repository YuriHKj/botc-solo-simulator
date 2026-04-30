# Grimoire UI 调研记录

## 参考来源
- 用户指定网页：`https://clocktower.gstonegames.com/grimoire/`
- 用户补充截图：会话中提供的 12 座位环形界面图。

## 本地采样结果
已抓取并保存以下研究文件：
- 页面源码：`docs/research/grimoire.html`
- 样式/脚本：`docs/research/app.css`、`docs/research/chunk-vendors.css`、`docs/research/app.js`
- 关键截图：`docs/research/grimoire-page.png`
- 素材采样：`docs/research/grimoire-assets/*`

## 观察到的核心视觉结构
1. 全屏夜景背景（蓝黑色调、雾气、月光）。
2. 中央环形座位，圆形 token + 座位编号牌。
3. 左上角显示配比与人数信息。
4. 左下角“恶魔伪装”三 token 卡片。
5. 中央放置剧本标识（logo/名称）。

## 本项目落地策略
- 采用“布局与氛围对齐”策略：复刻信息架构与视觉节奏。
- 素材版权未确认前，不将目标网页素材直接作为运行时依赖。
- 当前 demo 使用自绘样式实现环形 token、夜景氛围、bluff 卡片与 HUD。

## 后续可选项
1. 让 UI 支持“日/夜主题切换”。
2. 增加 token 的 reminder 角标层（中毒、醉酒、守护、鬼票）。
3. 增加右上设置菜单和快捷键提示层。
