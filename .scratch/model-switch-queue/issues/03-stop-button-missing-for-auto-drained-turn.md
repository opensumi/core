# 03: 排残过渡的 UI 观察:Stop 入口缺失 + 虚拟列表不再跟随流

Status: claimed Type: task Blocked by: none

## 现象(证据,2026-09-29 post-fix runs)

队列自动排残启动 turn 2 后,两个"活跃 turn"的可见 affordance 同时失效:

1. **Stop 缺失**:turn 2 流式输出期间,输入区脚注仍是 Send 图标,无 Stop 可点 (失败截图 test-failed-1.png:turn 2 chunks 可见、footer=Send)。
2. **虚拟列表停止跟随**:`AgenticVirtualMessageList` 在队列收起(queued 0)后不再自动跟随新增内容—— `.AI-Chat-slot` 的 `innerText` 在 turn 2 整个流式期间恒定不变(1469 字符 ×30s),滚动位置停在 turn 2 开头; 程序化滚到底后尾部内容**能挂载**(最终行出现 `Afresh` 操作项)——内容已到达 view,只是跟随/挂载窗口不动。

## 与根因修复(01)的关系

- 不是 01 的回归凭证问题:turn 2 的内容**确实送达并完成**(server:`request_1` → `agentStream done`;UI:滚动后可见完成态)。01 的回归 spec 用「滚到底+`Afresh`」绕开了(2)。
- 是否修复前已存在:V3 对照(pre-fix、切模型+自然结束)当时 turn 2 跟随渲染到了结尾(tail=CHUNK_60 Afresh), 但 V3 没有排残期间的间歇采样,**无法确定** (1)(2) 是否为新回归;两次现象同框出现,疑似同一根因 (排残 dispatch 过渡时 `loading`/stick-to-bottom 状态被打断)。

## 用户影响

自动排残的新 turn 生成期间:不能取消(1),新内容不上屏(2),像"卡住了"——与原始用户抱怨的体感一致,值得修。

## 下一步

- 在 view 层定位排残 dispatch 链路:`queuedTurnPortCallbacksRef.start → setChatLoading(true)` 之后 `didFinish(turn1) → setChatLoading(false)` / `syncLoadingWithThreadStatus` 的时序;以及 `AgenticVirtualMessageList` 的 `atBottomRef`/`followOutput` 在队列收起(高度变化)时的重算逻辑。
- 修复后,02 的 spec 可以把「Stop 可见」与「不滚动即跟随」的断言加回去。
