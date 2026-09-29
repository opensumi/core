# Spec: 生成中切换模型导致队列卡死

## 用户症状(来源:用户报告 + 诊断)

1. 生成中(turn 进行时)在输入区 footer 切换模型( sends `session/set_config_option`)。
2. 真实 agent 会在 prompt 进行中收到 `session/set_config_option` 而**崩溃**(mock 用 `--crash-on-config-change` 模拟)。
3. 生成中再发一条消息 → 正常进入队列(`acp-queued-turn`)。
4. 当前 turn 被崩溃打断后:
   - **症状 A**:队列进入 `Paused · Agent error`,不会自动排残,永远停留在队列里。
   - **症状 B**:点击 "Immediate Send" 向死连接发 prompt,把队列项转成会话内失败 turn(`ACP connection closed`), 无错误提示——看起来"点了没反应/消息丢了"。

根因与修复见 issues/01;回归仪器见 issues/02;遗留 UI 观察(非阻塞)见 issues/03。

## 验收条件(最终)

- mid-turn 切模型不得打断正在生成的 turn(Stop 保持可见,流继续增长)。
- 打开 crash 仪器时,队列排残 + turn 2 运行 + 全程无 "ACP connection closed"(证明配置变更没有打到活跃 prompt)。
- flush 在 turn 边界下发(jest 断言不发时序 + latest-wins + clear 丢弃)。

## 反馈回路

```bash
# 需本地 dev 环境: backend :8000 + yarn start:client:e2e :8080 (webpack 100%)
export PATH="/Users/ljs/.nvm/versions/node/v20.20.2/bin:$PATH"
cd tools/playwright && npx tsc --build ../../configs/ts/references/tsconfig.playwright.json
npx playwright test --config=./configs/playwright.config.ts acp-chat-agentic-model-switch-config-boundary
```

## 状态

- [x] Phase 1/2: 复现 + 最小化(真实 agent 崩溃由配置变更触发;mock 本身有韧性 → crash 仪器)
- [x] Phase 3: 假设清单收敛(根因=mid-turn set_config_option 打到 agent;队列机制本身正常,V3 对照证实)
- [x] Phase 4: 插桩定位(server 日志 14:52:27 RPC+threadStatus=working 锁定)
- [x] Phase 5: 修复(01)+ 回归(02):jest 56/56;e2e pre-fix red → post-fix green ×3(含清理后)
- [x] Phase 6: 清理(DEBUG 插桩移除、旧 repro 删除)+ 主题化提交
