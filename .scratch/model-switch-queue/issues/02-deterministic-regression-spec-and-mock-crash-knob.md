# 02: mock agent 增加 --crash-on-config-change 仪器 + 确定性 e2e 回归

Status: resolved Type: task Blocked by: 01

## 动机

- 旧 repro spec(`repro-model-switch-queue.test.ts`,未跟踪)用外部 `pgrep/kill` 杀 agent 模拟崩溃:目标 pid 选择脆弱 (首个 pid≠'67238')、依赖 macOS/Linux ps 方差,且"杀 agent"验证的是死亡善后,不是根因。
- 根因修复(01)的正确回归 = "mid-turn 配置变更不再打到 agent" → 用 mock 自带的 crash 仪器把"打到了"变成确定性红。

## 变更

1. `mock-acp-agent.mjs`:新增 `--crash-on-config-change`(env `OPENSUMI_ACP_BDD_CRASH_ON_CONFIG_CHANGE`);在收到 `session/set_config_option` 且 thread 处于 working 时,回复后 `process.exit(1)`(模拟真实 agent 崩溃)。
2. `acp-bdd-fixture.ts`:`crashOnConfigChange?: boolean` 透传 arg+env(同 longStreamTicks 模式)。
3. spec:`repro-model-switch-queue.test.ts` 重写为 `acp-chat-agentic-model-switch-config-boundary.test.ts`:
   - fixture `long-stream`(ticks=25)+ `crashOnConfigChange: true`;
   - 流程:发送长 turn → Stop 可见 → mid-turn 切模型 → Stop 仍在、流继续 → 第二条消息入队 → 自然结束后队列排残 (queued=0)→ turn 2 的 Stop 重现(以新模型运行)→ turn 2 自然结束;
   - 终局断言:全程 console 无 "ACP connection closed"(agent 未被崩溃)+ 队列无 Paused 摘要。
   - 删除旧 repro 文件(被本 spec 取代,诊断仪器代码一并退役)。

## 验收

- pre-fix + crash 仪器:红(agent 崩溃、队列 Paused)——证明仪器有效;
- post-fix:绿 ×2(本地确定性)。

## 落地与证据(2026-09-29)

- 仪器:`mock-acp-agent.mjs` `--crash-on-config-change`(收到 set_config_option 且 `pendingPrompts` 含该 session 时 `process.exit(1)`);`acp-bdd-fixture.ts` 透传 `crashOnConfigChange`。
- spec:`tools/playwright/src/tests/acp-chat-agentic-model-switch-config-boundary.test.ts`(旧 repro 文件已删除):
  - crash 产物:mid-turn 切模型 → 全部断言要求连接存活(终局 console 无 "ACP connection closed");
  - turn 2 完成断言改用「滚到底 + 最后一行消息出现 `Afresh` 操作项」的 `expect.poll`(120s): **发现队列收起后 `AgenticVirtualMessageList` 不再自动跟随流**(`innerText` 冻结、尾部行不挂载),内容其实已到 view(滚到底即可见)。该现象与 Stop 缺失同属排残过渡 UI 观察,记入 issues/03,不阻塞根因回归;
  - 全程 `data-testid=acp-queued-turn` 归零。
- 结果:pre-fix red(msq-prefix-red2.log,CRASH 15:44:46)→ post-fix green ×3(msq-postfix-green5/6/7.log), 清理后(bundle 无 DEBUG 残留)仍绿。
