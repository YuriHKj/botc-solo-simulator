# 项目三方向进展基准

更新日期：2026-05-31

本文作为后续继续深化项目时的基准快照，按三个方向整理当前状态：

- AI agent 智能程度
- UI 美化程度
- 游戏规则完成程度

本次判断主要依据当前代码、README、设计文档、测试契约和一次完整 `npm test` 结果。评分是开发成熟度参考，不代表最终产品质量。

## 总体判断

项目已经不是早期 demo，而是一个可运行、可测试、可打包的 BOTC 单人模拟器原型。当前架构的核心判断是：

- JS Core 已成为规则、AI、权限和状态的唯一事实源。
- Unity 已成为更接近正式游戏体验的前端承载层。
- AI 已从模板 NPC 进入“有个人视角、有证据、有策略倾向”的中高阶原型阶段。
- 规则层已经具备完整对局闭环，但距离官方级全角色细则仍有明显校准空间。
- UI 已经可玩且有气氛，但仍处在“强功能原型 + 局部视觉打磨”阶段，还没有完全变成统一、精致、稳定响应式的最终游戏界面。

当前推荐的深化顺序：

1. 继续提升 AI agent 的长期推理、证据引用和策略一致性。
2. 用角色审计矩阵补齐 BMR/SnV 官方边界和特殊交互。
3. 对 Unity UI 做视觉回归、响应式和核心场景美术化。

## 1. AI Agent 智能程度

当前成熟度：约 7/10，中高阶原型。

AI 已经明显超过“随机发言/模板发言”阶段。它现在有独立 agent 状态、可见性边界、证据簿、知识图谱、发言记忆、阵营策略、主动私聊和投票/提名参与能力。但它仍然主要是启发式策略系统加确定性文本渲染，尚不是稳定的长程博弈智能体。

### 已完成能力

- 每个 AI 有独立 `observations`、`evidenceBook`、`beliefTrailByPlayerId` 和 `knowledgeGraph`，私聊、夜间信息、公开发言、投票、提名会按可见性写入对应 agent。
- 邪恶方首夜互认和恶魔伪装已做权限隔离：恶魔知道爪牙和 bluff，爪牙知道恶魔，好人不会泄露这些隐藏信息。
- AI 公开/私下发言会读取自己可见证据，而不是直接读取全局真相；测试覆盖了私有信息不泄露到公聊、好人看不到恶魔隐藏知识等边界。
- 已有动态来源信任、污染风险、夜间信息可信度折扣、假声明降低信任、已验证声明提高信任等机制。
- 对话层支持公聊时钟、私聊追问、AI 主动私聊、AI-to-AI 私聊、死亡 AI 发言、身份声明策略、发言预算、重复语句冷却和 persona 差异。
- 策略层已经有 `evaluateGameWindow`、`evaluateGoodDayStrategy`、邪恶方 framing plan、coalition vote simulation、提名压力和投票阈值调整。
- 可选本地 LLM polish 已接入 Unity release flow，但只负责把已安全的确定性草稿润色成自然中文，不参与规则判断或隐藏信息推理。
- `tests/ai_agent_contracts.mjs` 覆盖范围很广，包括信息边界、证据簿、知识图谱、策略、发言记忆、私聊/公聊、提名投票、污染风险和隐藏信息防泄漏。

### 当前不足

- 推理仍以启发式和重算式 belief refresh 为主，还不是完整的增量贝叶斯记忆或多回合规划器。
- 长局一致性还没有量化评测；目前测试更像契约保障，不能完全证明“像真实玩家”。
- 证据引用已经接入很多场景，但发言仍混合模板、语料层和策略句，偶尔会出现工具感或重复结构。
- LLM polish 只改善口吻，不提升决策智能；模型失败时会回退到确定性文本，这是可靠但上限有限的设计。
- AI recap 对开发者有用，但还没有变成足够直观的玩家/调试双模式界面。

### 后续深化抓手

- 建立 AI 评测集：用固定局面检查隐藏信息边界、提名合理性、发言自然度、长局立场连续性和邪恶方协作。
- 把 `beliefTrailByPlayerId` 从“当前刷新解释”升级为可追踪整局的长期立场历史。
- 让更多发言显式来自 evidence/knowledge graph，而不是先有模板再补证据。
- 增强邪恶方策略：保护队友、换推目标、伪装身份连续性、刀口解释和投票联盟模拟。
- 把 AI recap 做成可选择 agent、目标和证据类型的图形化复盘面板。

## 2. UI 美化程度

当前成熟度：约 6.5/10，可玩的 Unity 视觉垂直切片。

UI 已经从 Electron 页面推进到 Unity fullscreen-first 原型。中心魔典、token、角色图标、死亡帷幕、reminder、私聊、公聊、提名投票、行动表单、Storyteller 队列和剧本手册都已经可用。当前问题不是“没有界面”，而是“界面还没有彻底从工具面板进化成稳定、统一、富有演出感的游戏体验”。

### 已完成能力

- Unity prototype 已可运行 demo，并通过 `unity_action.json` / `unity_viewmodel.json` 与 JS Core 闭环。
- 构建版支持自启动 JS Core bridge，发行包还能选择性启用本地 LLM polish。
- 已有 fullscreen-first 1920x1080 基线、中心魔典、顶部 HUD、底部 dock、阶段提示、菜单设置和同步状态反馈。
- 已接入私聊面板、公聊阶段辅助、提名互辩、投票仪式、终局反馈、剧本手册、角色选择器、reminder/mark-role、Storyteller 队列和动态行动表单。
- 视觉素材已经有官方风格参考方向：角色 token、背景、死亡帷幕、提醒物、字体、BGM 和阶段音景。
- Unity 迁移矩阵中大多数核心玩法 UI 已标记 Done，`reminder/魔典标记` 和 `AI 复盘摘要` 为 Partial，Electron 完整设置/存档迁移为 Planned。
- `unity-demo-acceptance` 覆盖 fresh state、选 token、私聊、公聊、提名、剧本手册、15 人投票导出和真实 Storyteller 队列。

### 当前不足

- Unity UI 大量由 C# 固定坐标生成，1920x1080 已有基线，但 1600x900、1366x768、高 DPI 和非 16:9 仍有脆弱性。
- 自动视觉验证还停留在 smoke 和契约阶段，缺少截图 diff、OCR、裁切/重叠检测。
- 私聊、公聊和投票已经可用，但仍有工具面板感；需要更强的角色/token 舞台、节奏、动效和音效。
- Token inspector、More actions drawer、AI recap 仍偏文本密集和调试风。
- Role picker、Storyteller queue、复杂 guesses 输入等还需要分页、滚动或更专门的控件。
- 无效行动主要靠提交后的提示反馈，按钮 disabled 状态和即时校验还不完整。

### 后续深化抓手

- 建立视觉回归：至少覆盖主魔典、私聊、公聊/阶段辅助、行动表单、Storyteller 队列、剧本手册、投票仪式、终局和 AI recap。
- 把私聊/公聊统一成更像视觉小说或桌边对话的舞台：token/头像、气泡、节奏、焦点目标和快速追问。
- 对投票和处决增加更强仪式感：举手动画、音效、结果停顿、死亡帷幕过场。
- 把 AI recap 从纯文本变成 suspect cards、证据 chips、信任/污染标记和可展开 trail。
- 把固定坐标逐步抽成少量布局组件，优先保证 1920x1080、1600x900、1366x768 三档。

## 3. 游戏规则完成程度

当前成熟度：整体约 7/10；TB 较完整，BMR/SnV 可玩但仍有简化。

规则层已经有完整对局闭环：开局、发牌、夜晚、白天、私聊、公聊、提名、投票、处决、死亡、胜负、Storyteller 队列和 Unity action bridge。它已经适合作为持续开发主干；接下来难点是从“可玩近似”升级到“官方细则可信”。

### 已完成能力

- 三个基础剧本已接入：TB 22 个角色，BMR 25 个角色，SnV 25 个角色。
- 当前结构化行动统计：TB 夜间行动 5 个、白天行动 1 个；BMR 夜间行动 15 个、白天行动 1 个；SnV 夜间行动 12 个、白天行动 1 个。
- `scripts/roles/` 已把角色规则从单体 engine 里逐步拆出，TB 模块化程度最高，BMR/SnV 也有角色定义、行动规则和简化 night runner。
- 已支持多种行动输入：`player-target`、`player-role`、`role`、`question`、`guesses`、`charge-or-targets`、`info`。
- 核心机制已具备：官方人数配置、男爵改外来者、酒鬼伪装、醉毒/中毒、误注册、邪恶互认、恶魔伪装、鬼票、提名投票、常见胜负和死亡触发。
- Storyteller 队列已覆盖 Ravenkeeper、Moonchild、Klutz、Barber、Sage 等需要暂停流程或选择/确认的信息。
- `npm test` 当前全绿，覆盖角色行动、被动信息队列、夜间行动完整性、AI、LLM renderer、Electron、Unity viewmodel/action bridge、资源同步、demo acceptance 和 mojibake。

### 当前不足

- BMR/SnV 仍有大量官方细则、特殊时机和 Storyteller discretion 点需要校准。
- 部分保护、复活、多杀、换角、异常胜负、醉毒错误信息还没有统一抽象成所有角色共享的精确规则接口。
- 复杂角色 UI 虽支持结构化 payload，但多组 guess、特殊模式和角色专属控件还没有全部美术化。
- 一些规则仍是概率或系统自动模拟 ST 判断，例如 Mayor 转移、信息选择质量、醉毒假信息风格。
- 自定义剧本方向已有接口基础，但还不是完整产品功能。

### 后续深化抓手

- 建立角色审计矩阵：每个角色标注 `Exact / Playable Approximation / Partial / Missing`，并列出官方偏差和测试缺口。
- 优先把死亡、保护、复活、攻击来源、角色交换、阵营变化、注册异常抽成统一事件管线。
- 为 BMR/SnV 做逐角色验收 fixture，尤其是多杀、保护链、醉毒/疯狂、Pit-Hag、Barber、Vortox、Zombuul 等高风险边界。
- 把 Storyteller discretion 从随机/固定模拟升级成可配置风格或可解释决策。
- 在规则稳定后再推进自定义剧本、旅人、寓言角色和更多官方/社区扩展。

## 当前验证基线

本次基准整理时已运行：

```powershell
npm test
```

结果：通过。

覆盖重点包括：

- 角色行动契约
- 被动信息和 Storyteller 队列
- 夜间行动完整性
- AI agent 与 LLM renderer 契约
- Electron build/path 契约
- Unity viewmodel/action bridge
- Unity asset sync
- Unity demo acceptance
- mojibake runtime text 扫描

Unity demo acceptance 输出确认覆盖：

- fresh state 初始化
- 第一夜到白天
- token 选择
- 私聊和公聊
- 提名投票
- 剧本手册
- 15 人投票导出
- `sage-info`、`ravenkeeper-info`、`barber-swap` 三类真实 Storyteller 队列

## 后续工作建议

如果接下来继续按这三个方向深化，建议把每条线都做成“可衡量目标”：

- AI agent：建立固定场景评测集，记录隐藏信息泄漏数、提名合理性、发言重复率、长期立场变化和邪恶方协作成功率。
- UI 美化：建立多分辨率截图回归，先把私聊、公聊、投票、AI recap 四个高频界面打磨到统一视觉语言。
- 游戏规则：建立角色审计矩阵和逐角色 fixture，先把 BMR/SnV 从 playable approximation 推进到 contract-backed accuracy。
