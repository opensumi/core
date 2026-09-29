# 01: turn 进行中推迟下发 session/set_config_option 到 turn 边界

Status: resolved Type: task Blocked by: none

## 问题(证据)

`AcpChatInternalService.setSessionConfigOption` 在 session thread 仍 `working`(prompt 在飞)时**立即**向 agent 发送 `session/set_config_option`:

- run-1 server 日志(run 时钟 t+23,turn A streaming 中):
  ```
  14:52:27 [AcpThread:w2Pr...] setSessionConfigOption()
  14:52:27 agentStream onData ... type=session_state, count=20, threadStatus=working
  ```
- 用户报告:真实 agent(claude-code 等)在 prompt 进行中收到该 RPC 会**崩溃 → 连接死亡**。
- 连接死亡后的次生症状(repro spec 断言的两个用户症状):
  - 队列进入 `Paused · Agent error`(不出错就绪的排残被阻断 → 症状 A "永远卡队列");
  - Immediate Send 向死连接发 prompt,失败后把队列项**转成会话内失败 turn**(`ACP connection closed / Afresh`),队列项消失、无错误提示(症状 B "点了没反应/消息丢")。

mock agent 对 mid-turn set_config 有韧性,所以此前本地回归一直绿。V3 对照实验(切模型+自然结束):turn 2 自动排残并完整跑完 (server 日志 request_1 → agentStream done updates=65)——证明**队列机制本身在 agent 存活时正常**,根因都收敛在 1。

## 修复

1. `setSessionConfigOption`:若 `isAcpResponsePending(sessionModel.threadStatus)` → 暂存 `{configId, value}`(每 optionId latest-wins)到 per-session pending map,**乐观更新本地 configOptions** 并 fire change(UI 立即反映选择),不发 RPC。
2. flush 挂点:`sendRequest` dispatch 前(per-session flush:逐条 await setSessionConfigOption,失败 warn 并继续,保持现状语义)。这覆盖队列排残/Immediate Send/手动发送所有 turn 边界,且保证下一个 turn 以新配置运行。
3. `clearSessionModel` 清掉对应 pending( attached to session 生命周期,类似 inputDrafts)。

Anxiety check: 推迟的对象只有"turn 进行中"的变更;不用 turn-imm(input 即时性)的场景不受影响;auth_required/stopping 一并算 作 pending(与 isAcpResponsePending 语义一致)。

## 验收

- jest(internal service seam):working 状态下 setSessionConfigOption 不发 RPC + 本地立即生效;sendRequest 前 flush 且 latest-wins;clear 后 pending 丢弃。
- e2e 回归 spec(见 02):开 crash 仪器的 mock,mid-turn 切模型 → 不崩、turn 2 自动排残并以新模型跑完;全程无 "connection closed"。

## 落地与证据(2026-09-29)

- 实现:`packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`(`stagePendingConfigOptionChange` / `flushPendingConfigOptionChanges` / `dropPendingConfigOptionChanges`,flush 挂在 `sendRequest` dispatch 前, `clearSessionModel` 丢弃 pending)。
- jest:`__test__/browser/chat/acp-chat-internal.service.test.ts` 3 个新用例,套件 56/56 通过 (working 期不发 RPC+本地生效;边界 flush+latest-wins;clear 丢弃)。
- e2e:`acp-chat-agentic-model-switch-config-boundary` pre-fix red(15:44:46 CRASH → 队列 Paused)→ post-fix green ×3。server 日志证实 flush 时机正确:
  ```
  [AcpThread] prompt() — done, status→awaiting_prompt      ← turn 1 RPC 返回,mock 清掉 pendingPrompts
  [AcpThread] setSessionConfigOption()                      ← flush(无 CRASH,连接存活)
  [ACP Back] setupAgentStream ... request_1                 ← 队列排残,turn 2 以新配置启动
  [ACP Back] agentStream done ... request_1, updates=30     ← turn 2 正常完成
  ```
