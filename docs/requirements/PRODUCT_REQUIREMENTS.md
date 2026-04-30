# BOTC 单机模拟器产品需求（v0.4）

## 1. 目标
在本地提供可单机游玩的《血染钟楼》模拟器，当前阶段重点如下：
- 三剧本可随机开局：Trouble Brewing、Bad Moon Rising、Sects & Violets。
- Trouble Brewing（暗流涌动）保持完整角色技能结算。
- Bad Moon Rising / Sects & Violets 进入“官方细则优先”的角色判定补全。
- 提供“魔典风格”可视化界面，支持主视角与全知视角切换。
- 局内可打开“剧本手册”，查看三剧本总览与夜间顺序参考。
- 除主视角外，AI 玩家具备基于证据的推理、发言、提名与投票能力。
- 桌面版交付为 BOTC-Solo 目录版 `.exe` + `_internal` 资源。

## 2. 范围定义

### 2.1 本次必须完成
- 三剧本按官方人数配比随机开局。
- TB 全角色技能保持可用与可追踪日志。
- BMR/SnV 角色细则补全（官方级优先）：
  - 覆盖首夜信息、常驻夜间信息、夜间击杀/保护/中毒/醉酒、处决触发、死亡触发、延迟胜负。
  - BMR 重点角色：Grandmother、Sailor、Chambermaid、Exorcist、Innkeeper、Gambler、Gossip、Courtier、Professor、Minstrel、Tea Lady、Pacifist、Fool、Tinker、Moonchild、Goon、Lunatic、Godfather、Devil's Advocate、Assassin、Mastermind、Zombuul、Pukka、Shabaloth、Po。
  - SnV 重点角色：Clockmaker、Dreamer、Snake Charmer、Mathematician、Flowergirl、Town Crier、Oracle、Savant、Seamstress、Philosopher、Artist、Juggler、Sage、Mutant、Sweetheart、Barber、Klutz、Evil Twin、Witch、Cerenovus、Pit-Hag、Fang Gu、Vigormortis、No Dashii、Vortox。
- `each night` / `each night*` 必须严格区分：
  - `each night`：首夜可触发。
  - `each night*`：首夜不触发，从第二夜开始。
- 胜负判定遵循用户规则：
  - 善良：在仅剩两人前或当下恶魔已死亡。
  - 邪恶：场上只剩两人且善良未获胜。
  - 同时满足时善良优先。

### 2.2 本次可保持简化
- 说书人自由裁定型文本能力（如 Gossip 语句真伪、Savant 命题内容）允许系统近似裁定，但必须记录日志说明。
- 不实现联机、语音、房间系统。
- 不实现旅行者、传奇角色与完整主持人裁定工具链。

## 3. UI 与素材要求
- UI 方向对齐官方魔典网页核心视觉：暗夜氛围、环形 token 桌面、高对比信息层。
- 素材来源采用 `https://clocktower.gstonegames.com/grimoire/` 研究提取结果，统一放在 `assets/ui/`。
- 角色图标来源采用钟楼百科页面资源，统一放在 `assets/roles/`。
- 三剧本总览与顺序参考图统一放在 `assets/references/`，局内可直接查看。

## 4. 交互需求
- 玩家白天可进行：私聊、公聊、提名、投票、跳过处决。
- 若主视角角色具备主动技能，需提供触发入口（夜间预设优先，白天技能按角色开放）。
- 夜间信息与私有提示应面向主视角隔离展示。
- 夜间结算顺序需对齐剧本顺序表口径，并在 UI 中可对照查看。
- 对话系统增强要求：
  - 私聊回复应基于玩家提问意图（如“怀疑谁/为什么”“你信任我吗”“你报什么身份”“今天会投谁”“昨夜死亡怎么看”“A 与 B 谁更可疑”）给出差异化内容。
  - 对话应使用 AI 当前嫌疑模型结果，不允许脱离局势胡言乱语。
  - 私聊与公聊需具备基础上下文记忆（至少按“本日轮次/最近关注对象/最近互动语气”维度）。
  - 公聊发言应减少模板重复，优先输出“目标 + 置信 + 理由”组合。

## 5. 验收标准
- 三剧本任意 5-15 人局可正常开局并推进至结束。
- BMR/SnV 新增角色细则均有对应代码分支与事件日志。
- 关键分支可触发：Mastermind 延迟结算、Vortox 无处决胜、Evil Twin 胜负分支、Klutz/Sweetheart/Barber 等死亡触发。
- UI 保持魔典式环形布局与夜色风格。
- `dist/BOTC-Solo/BOTC-Solo.exe` 可启动运行。
