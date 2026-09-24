# react-chat-elements 虚拟列表支持调查

调查时间：2026-07-31

## 结论

截至调查时，`react-chat-elements` 最新 npm 版本 `12.0.18` 的 `MessageList` **不支持虚拟列表（virtualization/windowing）**。它仍然对整个 `dataSource` 执行 `.map()`，为每条数据创建一个 `MessageBox`。因此，单纯把 OpenSumi 的依赖升级到最新版，不能解决长会话一次挂载全部消息 DOM 的性能问题。

上游仓库曾在 `optimized-list-renders` 分支做过一次基于 `react-virtuoso` 的实验，但该提交没有合入 `master`，也没有进入任何 npm 发布版本。它可以作为实现参考，不能当作社区组件已支持该能力。

建议：继续保留“使用虚拟列表优化长会话”的方案，不把依赖升级视为替代方案。实现上可评估 OpenSumi 已有 `VirtualList`，或参考上游实验分支直接使用 `react-virtuoso`，同时补齐动态高度、流式更新、底部跟随和会话级滚动锚点测试。

## 当前项目实际使用的版本

- `packages/ai-native/package.json` 声明的是 `react-chat-elements: ^12.0.10`，不是严格固定在 `12.0.10`：[`package.json`](../../package.json#L59)。
- 当前 `yarn.lock` 实际解析为 `12.0.14`：[`yarn.lock`](../../../../yarn.lock#L21498-L21500)。
- npm registry 显示最新版本为 `12.0.18`，发布于 2025-03-18；`12.0.10` 发布于 2023-06-05，`12.0.14` 发布于 2024-02-20：[npm registry 完整元数据](https://registry.npmjs.org/react-chat-elements)。

因此，本调查比较的是：项目声明下限 `12.0.10`、当前锁定版本 `12.0.14`、社区最新版本 `12.0.18`。

## 最新发布版本为何不是真正的虚拟列表

### 1. 最新版仍创建全部消息组件

官方 `master` 当前提交为 [`f487e7e`](https://github.com/Detaysoft/react-chat-elements/commit/f487e7e83320bee8b74ac758d17f1ad418343173)，其 `package.json` 版本为 [`12.0.18`](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/package.json#L1-L4)。

`MessageList` 的主体仍是：

```tsx
{
  props.dataSource.map((x, i: number) => <MessageBox key={i as Key} {...(x as any)} />);
}
```

完整源码见官方仓库 [`MessageList.tsx`](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/src/MessageList/MessageList.tsx#L137-L175)。这会为全部消息创建 React element，并且使用数组下标作为 key；源码中没有根据 viewport 只渲染可见区及 overscan 的逻辑。

最新版本的依赖列表也没有 `react-virtuoso`、`react-window` 或 `react-virtualized`：[官方 `package.json`](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/package.json#L87-L94)、[npm `12.0.18` 元数据](https://registry.npmjs.org/react-chat-elements/12.0.18)。

### 2. 滚动控制不等于虚拟化

组件支持 `lockable`、`toBottomHeight`、`downButton` 和 `onScroll`，但这些逻辑只读取或设置 `scrollTop`、`scrollHeight`，用于保持距底位置、自动滚到底部和展示回到底部按钮：[滚动位置维护](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/src/MessageList/MessageList.tsx#L24-L50)、[滚动事件和回到底部](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/src/MessageList/MessageList.tsx#L101-L127)。

真正的 virtualization/windowing 应只挂载可视区域附近的少量 item，并用占位高度维持整体滚动空间。当前实现不会减少已挂载的 `MessageBox` 数量，所以它只是“可滚动的完整列表”，不是“虚拟列表”。

## 从 12.0.10 / 12.0.14 升级到 12.0.18 是否有相关变化

对 npm 官方 tarball 中的 `src/MessageList/MessageList.tsx` 做比较：

- [`12.0.10 tarball`](https://registry.npmjs.org/react-chat-elements/-/react-chat-elements-12.0.10.tgz) 与 [`12.0.18 tarball`](https://registry.npmjs.org/react-chat-elements/-/react-chat-elements-12.0.18.tgz) 的消息渲染结构相同，都是全量 `dataSource.map()`。
- 两版在该文件的实质差异只是“回到底部”按钮图标从 `react-icons` 的 `FaChevronDown` 换成 Hugeicons；对应官方提交为 [`3ac4b02`](https://github.com/Detaysoft/react-chat-elements/commit/3ac4b02aa2cfc076f77293eb638a4ec842d995f7)。
- 官方针对 `MessageList.tsx` 的提交历史显示，2022-11-17 之后直到 2025-03-18，唯一变更就是上述图标替换：[文件提交历史](https://github.com/Detaysoft/react-chat-elements/commits/master/src/MessageList/MessageList.tsx)。

所以，从当前锁定的 `12.0.14` 升级到 `12.0.18` 不会带来消息窗口化，也不会改变长列表全量 DOM 的基本性能特征。

## 上游实验分支

官方仓库存在 `optimized-list-renders` 分支，其中单个提交 [`d5179f5`](https://github.com/Detaysoft/react-chat-elements/commit/d5179f598046cd03575b085f8c8f0ab4235d45ef) 引入了 `react-virtuoso`：

- 导入 `Virtuoso`：[`MessageList.tsx`](https://github.com/Detaysoft/react-chat-elements/blob/d5179f598046cd03575b085f8c8f0ab4235d45ef/src/MessageList/MessageList.tsx#L8-L12)。
- 使用 `totalCount` 和 `itemContent` 按需渲染：[`MessageList.tsx`](https://github.com/Detaysoft/react-chat-elements/blob/d5179f598046cd03575b085f8c8f0ab4235d45ef/src/MessageList/MessageList.tsx#L108-L130)。

这是真正的虚拟化实现，但 [`master...optimized-list-renders` 比较页](https://github.com/Detaysoft/react-chat-elements/compare/master...optimized-list-renders) 显示该分支只领先 1 个实验提交、同时已落后主分支多个提交。GitHub 的公开 PR 搜索未发现该提交对应的合并请求，它也不在 `master` 或 npm `12.0.18` 中。

这说明社区维护者探索过该方向，但目前不能通过稳定版 API 使用；若移植，需要由 OpenSumi 自己承担适配和维护。

## Release、Issue 和 PR 信号

- npm 的 `latest` 是 `12.0.18`：[npm package metadata](https://registry.npmjs.org/react-chat-elements)。
- GitHub Releases 页面记录的最新 release 条目仍是 [`v12.0.8`](https://github.com/Detaysoft/react-chat-elements/releases/tag/v12.0.8)，后续 npm 版本没有对应 GitHub release notes。
- 官方 [`CHANGELOG.md`](https://github.com/Detaysoft/react-chat-elements/blob/f487e7e83320bee8b74ac758d17f1ad418343173/CHANGELOG.md) 只记录到 `12.0.4`，没有宣称虚拟列表支持。
- 通过 GitHub Issues/PR 搜索 `virtualization`、`virtualized`、`"virtual list"`、`react-virtualized`、`virtuoso`，未发现已合并或正在推进的正式方案。搜索结果只能证明公开仓库当前可检索内容，不排除维护者在仓库外的计划；代码和已发布 tarball 才是本结论的主要依据。

## 对当前体验优化决策的影响

社区升级路线不能消除以下成本：

1. 切换长会话时，全量历史仍会生成并挂载全部 `MessageBox`。
2. Markdown、推理过程和工具调用等动态高度内容仍会全部参与 React reconciliation、布局和绘制。
3. 数组下标 key 也不适合作为 OpenSumi 会话消息的稳定身份。

因此建议将决策拆开：

- 可以另行评估是否升级 `12.0.14 -> 12.0.18`，但理由应是常规依赖维护或其他修复，不能把它列为长会话性能方案。
- 长会话性能仍需 OpenSumi 自己实现虚拟化，并使用稳定 message ID 作为 item key。
- 测试至少覆盖：大量动态高度消息之间切换、切回后恢复滚动锚点、底部流式追加、用户向上阅读时不抢滚动位置、展开/折叠工具调用后锚点稳定。

## 复核方法

本调查使用 npm registry 元数据和两个官方 npm tarball 作为发布事实来源，并以固定 SHA 的 GitHub 源码确认主分支实现。核心比较可复现为：

```bash
npm view react-chat-elements version dist-tags time repository --json
npm pack react-chat-elements@12.0.10
npm pack react-chat-elements@12.0.18
diff -u \
  v12.0.10/package/src/MessageList/MessageList.tsx \
  v12.0.18/package/src/MessageList/MessageList.tsx
```
