# Matt Pocock 工程技能工作流 — 研究笔记

**研究对象：**用户列出的 Matt Pocock 工程工作流技能（含 `/ask-matt`、`/clear`、`/compact`）。

**资料范围与身份：**一手来源为 Matt Pocock 维护的官方仓库 [mattpocock/skills](https://github.com/mattpocock/skills)，其 `package.json` 标明包名为 `mattpocock-skills`、许可证为 MIT、仓库地址即该仓库；README 将其定位为可组合、可适配、可用于 Codex 等编码代理的工程技能集。本笔记核对的 upstream 快照为 `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`（2026-08-24）。来源：[package.json](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/package.json)、[README：定位与 Codex 安装方式](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/README.md#L12-L61)。

## 结论

这不是一个强制的“从需求到提交”的单体框架，而是一组可组合的流程提示：核心路径是“澄清想法 →（需要时）规格与票据 → 实现”，并以 TDD、代码评审、领域建模等可复用纪律支撑。官方明确把技能区分为需用户显式调用的**编排技能**与可由模型自动选择的**纪律/参考技能**；前者可以调用后者，反向不成立。来源：[README：技能分类与工程清单](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/README.md#L187-L236)、[ask-matt：主流程](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L9-L33)。

本仓库已完成一次工程前置配置：issue/spec 使用本地 Markdown `.scratch/`，triage 标签与领域文档读取规则均已落在 `docs/agents/`。因此这里不应重复运行 `/setup-matt-pocock-skills`，除非要改变该约定。来源：[本仓库 issue 规则](/Users/ljs/ant/ide/core/docs/agents/issue-tracker.md)、[标签规则](/Users/ljs/ant/ide/core/docs/agents/triage-labels.md)、[领域文档规则](/Users/ljs/ant/ide/core/docs/agents/domain.md)。

## 当前 Codex 环境的可用性

下表“已安装”是对当前本机 `/Users/ljs/.codex/skills/<name>/SKILL.md` 的检查结果，不等同于未来会话、其他机器或某个 UI 斜杠命令一定可用。前端元数据中的 `disable-model-invocation: true` 表示该技能应由用户显式调用；没有该字段的技能可作为模型可选用的参考/纪律。该解释与官方 README 的调用角色分类一致。来源：[本机技能目录](/Users/ljs/.codex/skills)、[官方调用角色说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/README.md#L187-L236)。

| 名称 | 当前状态 | 官方定位 / 使用时机 |
| --- | --- | --- |
| `/setup-matt-pocock-skills` | 已安装；显式调用 | 每仓库首次配置 issue tracker、triage 标签、领域文档布局；其他工程流程以这些配置为前提。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/setup-matt-pocock-skills/SKILL.md) |
| `/grill-with-docs` | 已安装；显式调用 | 通过连续提问澄清设计，同时调用 `grilling` 与 `domain-modeling`，沉淀术语、`CONTEXT.md` 与 ADR。适合有工作目录时的功能构思起点。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/grill-with-docs/SKILL.md)、[路由说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L9-L17) |
| `/to-spec` | 已安装；显式调用 | 不再访谈；把已经讨论清楚的上下文综合为 spec，确认测试 seam 后发布到 tracker，并标为 `ready-for-agent`。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/to-spec/SKILL.md) |
| `/to-tickets` | 已安装；显式调用 | 将 spec/计划拆为可独立验证的 tracer-bullet 垂直切片，并声明阻塞边；本仓库对应 `.scratch/<feature>/issues/` 的独立文件。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/to-tickets/SKILL.md)、[本仓库 tracker 约定](/Users/ljs/ant/ide/core/docs/agents/issue-tracker.md) |
| `/implement` | 已安装；显式调用 | 根据明确 spec/ticket 实现；尽可能驱动 `/tdd`，结束时跑 `/code-review` 并提交当前分支。它是实现编排，不应替代前期需求澄清。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/implement/SKILL.md) |
| `/tdd` | 已安装；模型可调用 | 红 → 绿 → 重构；以事先确认的公共 seam 写行为测试，逐个垂直切片循环，避免实现耦合或一次性铺开测试。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/tdd/SKILL.md) |
| `/diagnosing-bugs` | 已安装；模型可调用 | 面向疑难 bug、性能回退、间歇故障；先建立能稳定报错的紧反馈循环，再最小化、假设/验证、修复并补回归测试。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/diagnosing-bugs/SKILL.md) |
| `/triage` | 已安装；显式调用 | 处理外部输入的 issue/PR：在分类和状态角色间推进、补信息、必要时 grilling，最终产出 agent-ready brief；不是 `/to-tickets` 生成票据的再加工步骤。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/triage/SKILL.md)、[路由说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L35-L40) |
| `/wayfinder` | 已安装；显式调用 | 用 tracker 上的“决策 ticket 地图”规划超过一个会话且路线不清的巨型工作；默认产出决策而非交付物，地图清晰后再进入 `/to-spec`。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/wayfinder/SKILL.md)、[路由说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L42-L50) |
| `/code-review` | 已安装；模型可调用 | 对固定基点至 `HEAD` 的 diff 分两轴并行评审：仓库规范（Standards）与原始 spec/issue（Spec）；必须先确定比较基点。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/code-review/SKILL.md) |
| `/resolving-merge-conflicts` | 已安装；模型可调用 | 已处于 merge/rebase 冲突时，追溯双方改动意图及其一手来源，逐 hunk 保留意图、验证并完成操作；技能要求不执行 `--abort`。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/resolving-merge-conflicts/SKILL.md) |
| `/prototype` | 已安装；模型可调用 | 为一个设计问题写一次性原型：逻辑/状态问题做可交互 HTML，UI 问题做多变体；验证的结论回流正式工作，原型保留在主分支外作为证据。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/prototype/SKILL.md) |
| `/research` | 已安装；模型可调用 | 后台代理查阅高可信一手资料，并在仓库写带引用 Markdown；研究结果用于支撑后续澄清/规格，不替代决策。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/research/SKILL.md)、[路由说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L87-L89) |
| `/handoff` | 已安装；显式调用 | 产出可携带的上下文 Markdown，写入操作系统临时目录；适用于换 harness/目录、交给他人或中途分叉任务，不是同一会话的默认压缩方式。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/productivity/handoff/SKILL.md)、[官方 handoff 说明](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/docs/productivity/handoff.md) |
| `/ask-matt` | 已安装；显式调用 | 工作流路由器：按当前情况推荐主流程、bug/triage/wayfinder 等入口及阶段边界选择；它本身不实现功能。来源：[技能](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md) |
| `/clear` | **非 Matt skill；当前技能目录未安装** | 官方 `ask-matt` 将其称为阶段边界的“清空窗口、从零开始”选项。它是宿主客户端命令/能力，而非 upstream `skills/**/SKILL.md`；是否能在当前 Codex UI 输入取决于产品，不能把它当作已注册技能调用。来源：[阶段边界定义](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/PHASE-BOUNDARIES.md#L8-L25) |
| `/compact` | **非 Matt skill；当前技能目录未安装** | 官方将其定义为把上下文压缩并带入新窗口的阶段边界兜底选项；仅在“继续、清空、移交、子代理”都不合适时使用，避免摘要抹平关键决策。实际可用性同样由 Codex 产品决定。来源：[阶段边界决策树](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/PHASE-BOUNDARIES.md#L19-L40) |

## 建议的流程映射

```text
已有 repo 的新想法
  → /grill-with-docs
  → （小、单会话）/implement → /tdd → /code-review
  → （多会话）/to-spec → /to-tickets → 每张 ticket /implement

原始外部 issue/PR → /triage → /implement
难复现/难解释的故障 → /diagnosing-bugs
巨大且路线不明的目标 → /wayfinder → /to-spec → /to-tickets
无法纸上确认的状态或 UI 问题 → /handoff → /prototype → /handoff → 回到主流程
```

该映射是官方 `/ask-matt` 的主流程、两个入口与 prototype 分支的压缩表达。尤其要区分：`/triage` 的输入是外部、尚未准备好的需求；`/to-tickets` 的输入是已澄清的计划/规格，产物可直接实施。来源：[ask-matt：主流程与上下文卫生](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L9-L33)、[ask-matt：入口](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L35-L50)、[ask-matt：独立工具](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/ask-matt/SKILL.md#L74-L89)。

## 对用户原说明的两点校正

1. “当前列出的可用 skills 里没有 `ask-matt`”在本会话环境中已不成立：本机存在 [ask-matt 技能文件](/Users/ljs/.codex/skills/ask-matt/SKILL.md)，并且当前技能目录也包含其余列出的 Matt 技能。
2. `/clear`、`/compact` 被官方工作流**引用**，但不是 `mattpocock/skills` 仓库中的技能目录；将它们列作“Matt 的 skill”会混淆工作流建议与宿主产品命令。本会话能否执行它们，应以 Codex 的实际 UI/产品支持为准。
