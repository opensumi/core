# 04: 修复 CI 上两条 draft 相关 flaky e2e(input-send ArrowUp 召回 / New Session 草稿携带)

Status: in-progress Type: task Blocked by: 02

## 动机

CI(`E2E Test` workflow,本分支自 9/28 起)两条非本工作引入的失败,阻塞整体绿灯:

1. `acp-chat-agentic-input-send.test.ts`:发送完成后按 ArrowUp 应召回上一条已发送消息,CI 上输入框保持空(`toContainText(FIRST_LINE)` 超时)。基线 `bb0e14e86d` 同样红(pre-existing)。机理:召回是**一次性按键**对编辑器实例内 history 状态;慢 CI 上 git 仓库发现弹层("A git repository was found…",workspace 在 repo 内才会出现)可在 focus() 与按键之间抢焦点,按键丢失后无重试。
2. `acp-chat-layout-aware-new-draft.test.ts`:在已绑定会话输入 'preserved Agentic draft' 后点 New Session(项目组 `agentic-task-launch-button`),期望草稿携带进 Task Draft 阶段;CI 上输入框为空。机理:`enterAgenticTaskDraft` 的草稿携带依赖时序——`enterDraftSession` 清空 draft 槽后,视图的会话切换恢复效果读到空 incoming 草稿且编辑器已被重置时,`restoreDraft('')` 落地,文本永久丢失;本地异步链快,未触发该窗口。CI 失败截图(pw-report fe48 run,layout-aware retry1)可见草稿阶段正常进入但输入空,右下角 git 弹层同时在场。

## 变更

1. 产品修复 `chat.internal.service.acp.ts` `enterAgenticTaskDraft`:进入草稿阶段前把绑定会话的未发送草稿 seed 进 `ACP_INPUT_DRAFT_SLOT`(守卫 `hasAcpChatSendPayload`,与 578 行既有 slot→session 迁移对称)。此后无论恢复效果读到相等跳过、还是编辑器已被清空后恢复,文本都确定保留。
2. 测试加固 `acp-chat-agentic-input-send.test.ts`:ArrowUp 召回改为 `expect.poll` 重按(每次重聚焦;单条 history 时索引封顶,重复按键幂等),覆盖焦点被 CI 弹层抢走的竞态。
3. jest:`acp-chat-internal.service.test.ts` 新增 2 例(非空草稿携带 + 空草稿不携带)。

## 验收

- browser jest 全绿(含新 2 例);
- 本地 e2e:layout-aware / input-send / per-session-input-draft / draft-footer 绿;
- CI `E2E Test` 上两条 flake 不再失败。

## 落地与证据

- jest:tsc ai-native exit 0;browser 套件 67 passed / 878 tests(含新增)。node 侧 3 套件失败为 node-pty NODE_MODULE_VERSION 环境问题(本机默认 Node v24 vs ABI 115),与改动无关。
- 本地 e2e(2026-10-09,node v20.20.2,dev = HOST=127.0.0.1 start:e2e):layout-aware / input-send / per-session-input-draft / draft-footer **4 条全绿**(21.1s,--retries=0);同发送路径的根因回归 `acp-chat-agentic-model-switch-config-boundary` 亦绿(1.1m)。排障备注:直接在 packages/startup 跑 `start:e2e` 会缺 HOST,webpack 注入 `ws://0.0.0.0:8000` 握手失败导致 workbench 白屏、waitForWorkbenchReady 全挂;须走根目录脚本(env HOST=127.0.0.1)。
- CI:待推送后复核。
