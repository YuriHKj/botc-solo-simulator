# AI 发言自然化接入说明（2026-05-05）

## 当前结论

项目里已经做过“公开语料接入与训练”的工作，但它现在主要用于本地理解/分类，而不是直接生成自然语言。

已存在内容：

- `data/raw/aiwolf/`
- `data/raw/llmafia/`
- `data/raw/werewolf_among_us/`
- `train/train_transfer_models.py`
- `train/export_runtime_model.py`
- `models/speech_acts_model.joblib`
- `models/vote_stance_model.joblib`
- `models/training_report.json`
- `scripts/ml_runtime_model_data.js`
- `scripts/ml_runtime.js`

这些内容构成的是本地轻量分类器：

- `speech_acts_model`：判断发言是否像质询、维护、报身份、软报、控票等。
- `vote_stance_model`：判断发言对投票/处决的倾向。
- `scripts/ml_runtime.js`：把模型导出数据转换为浏览器/Electron 可运行的纯 JS 推理。

它们不会像 LLM 一样“写一句新话”，而是给 AI 系统提供语义信号。

## 之前没有完全应用到的地方

训练模型已经接入了：

- 玩家自由输入意图判定。
- 公聊/私聊发言的 speech act 标注。
- 投票倾向与发言元数据。
- 部分私聊理解逻辑。

但它没有充分接入：

- 公聊发言的文本生成。
- AI 主动找玩家私聊的文本生成。
- AI 与 AI 私聊的文本生成。
- 不同人格的表达差异。

也就是说，之前更多是“听懂一点”，不是“说得更像人”。

## 本次补充

本次补充采用“公开语料训练分类器 + 独立语料模板生成器”的混合方案。

修改点：

- 扩展 `scripts/ai_speech_corpus.json`。
- 新增公聊模板：施压、试探、死人报身份、公聊阶段前缀、人格尾句、提名压力尾句。
- 新增主动私聊模板：死人交信息、主动同步、有信息私聊、推进目标、无明确目标时的建议。
- 将模板接入 `scripts/ai.js` 的这些生成路径：
  - `composePublicLine(...)`
  - `composeProactiveWhisper(...)`
  - `composeAIToAIWhisper(...)`
  - 邪恶同阵营私聊继续使用 `composeHumanizedEvilAllianceResponse(...)`

## 复盘句式抽取与 persona 分化

基于 `docs/复盘2.txt` 与 `docs/新建 Text Document.txt`，本次继续抽取了可复用的说话方式，但没有保留具体座位、身份和某局结论。

抽取后写入 `scripts/ai_speech_corpus.json` 的 `persona` 区：

- `steady`：稳健型。常用“我按现在的盘面说”“这题我分两层看”“交叉验证”等句式。
- `pressure`：强压型。常用“先不绕，直接说重点”“别拖节奏”“先控场，再验反应”等句式。
- `shadow`：隐锋型。常用“台面上可验证的部分”“先看票型和行为链”“不急着暴露细节”等句式。

接入位置：

- 私聊开场：`persona.*.privateOpeners`
- 身份拒报/范围报：`persona.*.claimDeflect`
- 公聊尾句：`persona.*.publicTails`
- 公聊/私聊推进目标：`persona.*.focusPush`

目标是让不同 AI 在相同证据下有不同表达风格，而不是改变它们掌握的信息或底层阵营逻辑。

## 设计原则

1. 训练模型继续负责理解，不直接生成文本。
2. 文本生成尽量走独立 JSON 语料库，便于后续人工扩写和替换。
3. 生成句子必须绑定当前 agent 的观察与怀疑值，不能凭空编信息。
4. 邪恶方对非队友不能泄漏真实邪恶互认/间谍/魔典信息。
5. 输出减少机械格式，比如少用“我按证据顺序说”“99%”这类模板化口吻。

## 下一步建议

1. 从真实复盘日志中人工挑选“人味句式”，按场景扩充 `ai_speech_corpus.json`。
2. 给每个 AI persona 增加专属模板池，例如稳健型、压迫型、躲闪型。
3. 把生成出的句子做轻量后处理：去重复、去过长、合并短句。
4. 将 speech act 分类结果反过来影响模板选择，例如“质询阶段”优先选择 challenge 模板。
