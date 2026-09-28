# WikiSkill — 研究笔记

**论文：**[_WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution_](https://arxiv.org/html/2608.27454v1)（arXiv:2608.27454v1，2026 年 8 月 27 日）  
**作者：**Liyan Tang、Cyrus Rashtchian、Chun-Sung Ferng、Andrew Tomkins、Da-Cheng Juan 与 Tu Vu（Google Research；Tu Vu 还隶属 Virginia Tech）。

## 核心结论

WikiSkill 是一个技能演化框架：它在原始 Agent 轨迹与可执行技能之间维护一份持久化、结构化的 wiki。论文的核心主张是，将过去的成功、失败及被拒绝的改动编译到这一独立知识层后，相比洞见仍分散于历史优化产物中的方法，可更有效地完成后续技能更新。作者的实验显示，它在五个被评估模型上平均优于所选技能演化基线，也展现出一定的跨模型迁移能力。这些结果均为作者报告的实验结果，尚非独立复现结论。

来源：[摘要](https://arxiv.org/html/2608.27454v1#abstract1)、[研究动机与贡献](https://arxiv.org/html/2608.27454v1#S1)。

## 方法

工作区由三层组成：

- `raw/`：不可变的、逐步记录的训练执行轨迹。
- `wiki/`：持久化的 Markdown 模式页、演化日志，以及由程序更新的 `skill-impact.md`；该文件记录提议、验证分数和接受/拒绝结果。
- `skills/`：当前生效的过程性技能目录；每个目录包含 `SKILL.md` 和将该技能关联到其动机 wiki 模式的 `PURPOSE.md`。

每轮迭代中，Inference Agent 使用当前技能执行任务；Wiki Maintainer 汇总采样到的成功和失败轨迹；随后，一个 ReAct 风格的 Skill Proposer 创建一项原子化的技能新增或补丁。验证门仅在候选方案超过当前最佳验证分数时接受它；被拒绝的技能改动会回滚，但 wiki 会保留。执行任务时，Inference Agent 无法访问 wiki。作者将完整的技能文本直接注入提示词，因此特意没有研究技能检索和触发失败的问题。

来源：[三层架构](https://arxiv.org/html/2608.27454v1#S3.SS1)、[框架概览](https://arxiv.org/html/2608.27454v1#S3.F2)、[演化循环](https://arxiv.org/html/2608.27454v1#S3.SS2)、[验证门与回滚](https://arxiv.org/html/2608.27454v1#S3.SS2.SSS3)、[技能注入方式](https://arxiv.org/html/2608.27454v1#S3.SS2.SSS0.Px1)。

## 评估与作者报告的结果

研究覆盖五类任务：LiveMath 数学推理、SealQA 网页搜索、SpreadSheet 电子表格操作、OfficeQA 长上下文文档问答，以及 ALFWorld 具身交互任务。被评估的模型包括 Gemini-3.5-Flash、Qwen-3.5-4B/9B-Instruct、Qwen-3.6-27B 和 Gemma-4-31B-It；比较的基线为无技能、Trace2Skill、EvoSkill 与 SkillOpt。所有方法均从无技能开始；分数为三次独立完整演化运行的平均测试表现。论文采用 1,000 次迭代的配对 bootstrap 检验，以 \(p < 0.05\) 报告显著性。

来源：[实验设置](https://arxiv.org/html/2608.27454v1#S4.SS1)、[完整表 1 与实验协议](https://arxiv.org/html/2608.27454v1#S4.T1)。

作者报告的主要发现：

- 与每个模型表现最强的竞争性技能演化方法相比，Qwen-3.5-4B、Qwen-3.5-9B、Qwen-3.6-27B、Gemma-4-31B 和 Gemini-3.5-Flash 的平均分数分别提高 **3.3、5.1、10.0、5.8 和 12.0 个百分点**。例如，Gemini-3.5-Flash 在 LiveMath 上从无技能时的 33.0% 升至 72.6%，在 SpreadSheet 上从 50.5% 升至 76.6%；Qwen-3.6-27B 在 ALFWorld 上从 52.8% 升至 77.6%。[主要结果分析](https://arxiv.org/html/2608.27454v1#S4.SS2.SSS1)
- 在 Qwen 系列中，作者报告相对于无技能基线的平均增益随模型变大而上升：4B、9B 和 27B 分别为 **+12.3、+17.5 和 +23.9 个百分点**。使用 WikiSkill 的 Qwen-3.5-9B 平均得分为 47.4%，超过无技能 Qwen-3.6-27B 的 39.4%。[规模分析](https://arxiv.org/html/2608.27454v1#S4.SS2.SSS1)
- 技能可在模型间迁移：由 Qwen-3.6-27B 演化出的技能使 Qwen-3.5-9B 在 SpreadSheet 上达到 50.5%，高于无技能的 24.3% 和自身演化技能的 33.6%；其也使 Gemma-4-31B 在 LiveMath 上达到 73.7%，高于 33.9% 和 56.7%。不过迁移并非始终有益：Qwen-3.5-4B 的 SpreadSheet 技能会使 Gemini-3.5-Flash 从 50.5% 降至 18.1%。作者将其归因于源模型特有的低层操作规避策略，以及冗余诊断调用耗尽了目标模型的交互预算。[跨模型分析](https://arxiv.org/html/2608.27454v1#S4.SS2.SSS2)
- 消融实验中，默认配置平均得分为 63.7；若 Skill Proposer 无法持久访问 wiki，则为 48.7（−15.0）；若 Inference Agent 也能查看 wiki，则为 60.9。在 LiveMath 上，允许推理时访问 wiki 会使分数从 72.6% 降至 64.8%。这是论文关于持久化知识层有效、且任务执行时不应暴露 wiki 的直接证据。[消融讨论](https://arxiv.org/html/2608.27454v1#S5.SS1)、[表 3](https://arxiv.org/html/2608.27454v1#S5.T3)

## 局限与解读

作者明确指出四项局限：

1. 直接注入技能文本意味着研究没有评估：随着技能集合增长，技能检索和触发是否仍然有效。
2. 只接受带来提升的验证策略会拒绝短期中性、但可能促成后续收益的改动。
3. wiki 会持续增长，尚无自动化清理机制。
4. 基准未覆盖极长时程工作（数百个动作或数小时），也未覆盖单次执行过程中的在线技能适应。

来源：[局限性](https://arxiv.org/html/2608.27454v1#Sx1)。

因此，现有证据支持的是一个受控结论：**在五个选定基准上，通过完整提示词注入技能的演化方法**有效；它尚不能证明技能库可无限增长且仍能高效检索，也不能证明其适用于在线长时程适应。已记录的负迁移同样表明：源模型演化出的过程不应被直接假定能泛化到目标模型，必须针对目标模型重新评估。
