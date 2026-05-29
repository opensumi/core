# OpenSumi WebMCP Tool Capabilities

## 目标

本文维护 OpenSumi IDE 通过 WebMCP 暴露给 Claude Code agent 的工具能力设计，用于评审工具粒度、默认暴露范围、风险级别、权限策略和上下文预算。

Claude Code agent 通常已经具备：

- 文件系统读写
- shell/bash 执行
- git 操作
- 测试命令执行
- 项目源码分析

因此 OpenSumi WebMCP 的重点不是重复这些通用能力，而是暴露 Claude Code 无法从自身环境稳定获取的 IDE 增量能力：

- 用户当前 IDE 上下文：active editor、selection、open files、dirty buffers。
- IDE terminal 现场：用户已有终端、正在运行的进程、最近输出、长进程增量输出、受控交互。
- LSP/语言服务语义：diagnostics、symbols、definition、references、hover、code actions。
- IDE UI 呈现：打开文件、跳转位置、展示 diff、聚焦 panel。
- ACP Chat 运行态：当前会话状态、permission 等待状态、chat panel 展示。
- OpenSumi 状态：workspace roots、SCM 视图、debug sessions、tasks、problems。

一句话：Claude Code 负责“改代码和跑命令”，OpenSumi WebMCP 负责“告诉它 IDE 当前看到什么、语言服务怎么看、用户终端发生了什么，并把结果展示回 IDE”。

## 设计原则

- 工具粒度保持在 IDE 语义动作层，不直接暴露内部 service API。
- 默认优先暴露 `read` 和低风险 `ui` 能力。
- 交互型能力可以暴露，但必须可审计、可权限控制、可被用户理解。
- 高风险写入、shell、destructive 能力默认不暴露或必须经过权限确认。
- 优先暴露 Claude Code 缺失的 IDE 状态，不把 WebMCP 做成另一套文件系统和 shell。
- `tools/list` 需要持续观测 schema、description 和 total tool definition 字节数。

## 风险级别

| Risk          | 含义                                               | 默认策略                           |
| ------------- | -------------------------------------------------- | ---------------------------------- |
| `read`        | 只读取 IDE、workspace、terminal、LSP 或 SCM 状态   | 可以默认暴露                       |
| `ui`          | 改变 IDE 可见状态，如打开文件、跳转位置、聚焦面板  | 可以默认暴露，但不应修改代码或进程 |
| `write`       | 修改文件、编辑器 buffer、workspace 配置或 SCM 状态 | 谨慎暴露，建议权限确认             |
| `shell`       | 创建终端、输入命令、发送控制键、影响进程           | 需要审计，关键操作建议权限确认     |
| `destructive` | 删除文件、关闭终端、停止进程、不可逆操作           | 默认不暴露或强权限                 |

## 默认暴露策略

当前阶段采用轻量曝光策略，而不是完整权限系统。`profile`、`riskLevel` 和 `exposedByDefault` 用来控制初始工具面、描述风险和支撑日志观测；真正的高风险操作仍应在具体 tool 执行时走权限确认或业务校验。

HTTP MCP 入口只暴露：

- `defaultLoaded` group
- 且 `exposedByDefault !== false` 的 tool
- 且匹配当前 `ai.native.webmcp.profile` 的 tool

`ai.native.webmcp.profile` 取值：

| Profile       | 默认用途                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `minimal`     | 只暴露 IDE 当前上下文、diagnostics、editor buffer/dirty、terminal 观察 |
| `default`     | `minimal` + 必要 IDE UI 展示；不默认暴露 search/file read              |
| `interactive` | `default` + search/file read + terminal 创建、输入、控制键、运行命令   |
| `full`        | 最大能力面；仍受 `exposedByDefault: false` 保护                        |

新增工具时，默认策略应按下面判断：

| 类型              | Default         | 说明                                                         |
| ----------------- | --------------- | ------------------------------------------------------------ |
| IDE 上下文读取    | yes             | 如 active editor、open files、workspace roots                |
| 语言服务读取      | yes             | 如 diagnostics、symbols、definition、references、hover       |
| terminal 输出读取 | yes             | Claude Code 无法看到用户 IDE 终端现场                        |
| IDE UI 展示       | yes             | 如 open/reveal/showDiff/focusPanel                           |
| terminal 受控输入 | configurable    | 可以默认可用，但必须审计，产品上应可配置是否每次确认         |
| 直接命令执行      | configurable/no | Claude Code 已有 bash；IDE terminal 执行用于用户可见交互场景 |
| 文件系统写入      | no/compat       | Claude Code 已有文件写入；仅为兼容保留                       |
| destructive 操作  | no              | 删除、kill、dispose 等默认关闭或强确认                       |

当前先按以上规则上线观察，不提前把 `exposedByDefault` 设计成复杂的长期权限模型。如果真实使用中发现 agent 能稳定理解 catalog、权限确认体验清晰、误调用风险可控，可以再考虑放宽或移除部分保留字段。

## Capability Catalog 与自主探索

目标：让 `tools/list` 默认保持小，同时让 Claude Code agent 能自主发现和启用 OpenSumi 的更多 IDE 能力。

默认 `default` profile 不再追求“一次性暴露足够多工具”，而是暴露：

- 核心 IDE 上下文工具
- terminal 观察工具
- diagnostics 工具
- 少量 editor UI 工具
- capability catalog 元工具

### Catalog 元工具

默认暴露以下元工具：

| Tool | Risk | Default | 用途 |
| --- | --- | --- | --- |
| `opensumi_discoverCapabilities` | `read` | yes | 发现当前未暴露的 OpenSumi IDE capability groups |
| `opensumi_describeCapabilityGroup` | `read` | yes | 查看某个 capability group 的工具列表和参数摘要 |
| `opensumi_describeTool` | `read` | yes | 查看单个工具的完整 schema |
| `opensumi_enableCapabilityGroup` | `read` | yes | 为当前 session 启用一个 capability group |
| `opensumi_invokeCapabilityTool` | `read/ui/write/shell` | fallback | 在 MCP client 不刷新 tools/list 时，按名称调用已描述过的工具 |

`opensumi_discoverCapabilities` 不返回完整 schema，只返回轻量目录：

```ts
{
  task?: string;
  includeDisabled?: boolean;
}
```

返回示例：

```json
{
  "recommended": [
    {
      "group": "search",
      "reason": "Task needs workspace-wide lookup.",
      "nextAction": "opensumi_enableCapabilityGroup",
      "arguments": { "group": "search" }
    }
  ],
  "groups": [
    {
      "name": "search",
      "summary": "Search files, text, and symbols using IDE services.",
      "whenToUse": "Use when the exact file path or symbol location is unknown.",
      "risk": "read",
      "profile": "interactive",
      "toolCount": 3,
      "estimatedBytes": 1992,
      "enabled": false
    }
  ]
}
```

`opensumi_describeCapabilityGroup` 返回某个 group 的工具列表，默认不返回完整 JSON Schema：

```ts
{
  group: string;
  includeSchemas?: boolean;
}
```

`opensumi_describeTool` 只返回单个工具的完整 schema，用于避免一次性把整个 group 的 schema 塞进 context。

### Enable 流程

如果 Claude Code 支持 tools refresh，推荐流程：

1. agent 发现当前 tools 不足。
2. 调用 `opensumi_discoverCapabilities({ task })`。
3. 根据 `recommended` 调用 `opensumi_enableCapabilityGroup({ group })`。
4. OpenSumi 在当前 session 记录 `enabledGroups`。
5. Claude Code 重新 `tools/list` 后看到新增 group 的 tools。

`opensumi_enableCapabilityGroup` 本身不执行 IDE 动作，只改变当前 session 的工具暴露状态，因此不应触发权限确认。高风险 tool 的权限仍在具体 tool call 上处理。

MVP 语义：`enableCapabilityGroup` 表示 agent 在当前 MCP session 内显式展开某个 capability group。它不是权限授予，也不执行 IDE 动作；它只是让后续 `tools/list` 或 fallback broker 能看到更多已注册工具。是否需要用户确认，应由被调用的具体工具决定。

如果 Claude Code 不会重新 `tools/list`，使用 fallback：

1. agent 调用 `opensumi_describeCapabilityGroup({ group, includeSchemas: true })`。
2. agent 调用 `opensumi_invokeCapabilityTool({ tool, arguments })`。
3. OpenSumi 执行参数校验、权限路由和审计日志。

### 提高 enable 概率的设计

为了让 agent 更可能主动探索和调用 `enableCapabilityGroup`：

- catalog 工具命名使用行动导向：`discoverCapabilities`、`enableCapabilityGroup`，避免只叫 `list`。
- `opensumi_discoverCapabilities` 的 description 明确写：当需要 search、language navigation、SCM、debug、tasks、output logs、terminal interaction 且当前 tool list 没有时调用。
- ACP session 初始 prompt 增加短提示：OpenSumi 默认只暴露最小 WebMCP 工具集；如果需要未列出的 IDE 能力，先调用 `opensumi_discoverCapabilities`，再启用对应 group。
- catalog 返回 `recommended.nextAction` 和可直接复用的 `arguments`，降低 agent 自己规划成本。
- core tools 遇到能力不足时返回 `CAPABILITY_NOT_ENABLED`，并在 `details` 里提示应启用哪个 group。
- `enableCapabilityGroup` 返回 `refreshRequired`、`fallbackTool` 和 fallback 调用示例，避免 MCP client 不刷新 tools 时卡住。

示例：

```json
{
  "enabled": true,
  "group": "search",
  "refreshRequired": true,
  "fallbackTool": "opensumi_invokeCapabilityTool",
  "example": {
    "tool": "opensumi_invokeCapabilityTool",
    "arguments": {
      "tool": "search_text",
      "arguments": { "query": "createWorkspaceGroup" }
    }
  }
}
```

### Catalog 观测

新增以下日志：

- `capabilities/discover`：`taskChars`、`recommendedGroups`、`groupCount`
- `capabilities/describeGroup`：`group`、`includeSchemas`、`schemaBytes`
- `capabilities/describeTool`：`tool`、`schemaBytes`
- `capabilities/enableGroup`：`group`、`enabledGroups`
- `capabilities/invokeTool`：`tool`、`group`、`riskLevel`、`success`

这些日志用于判断 agent 自主探索漏斗：

- 是否调用 discover
- discover 后是否 enable
- enable 后是否重新 tools/list
- 如果没有刷新，是否使用 invoke fallback

## Capability Groups

### 1. workspace

目标：给 agent 当前 OpenSumi workspace 和窗口上下文。

| Tool                             | Risk   | Default | 用途                                                   |
| -------------------------------- | ------ | ------- | ------------------------------------------------------ |
| `workspace_getInfo`              | `read` | yes     | 获取 workspace roots、workspaceDir、多根状态、窗口环境 |
| `workspace_listOpenFiles`        | `read` | yes     | 获取当前打开文件、active file、editor group 信息       |
| `workspace_listRecentWorkspaces` | `read` | yes     | 获取最近 workspace，低优先级                           |
| `workspace_getTrustState`        | `read` | later   | 获取 workspace trust 或安全状态                        |
| `workspace_getSettings`          | `read` | later   | 读取 allowlist 中的 IDE/workspace 设置                 |

设计重点：

- 不暴露任意 preference 读取，先做 allowlist。
- roots 和 open files 是默认上下文，不应依赖 agent 自己猜。

### 2. editor

目标：暴露用户当前正在看的代码上下文，尤其是 selection 和未保存内容。

| Tool                         | Risk    | Default      | 用途                                    |
| ---------------------------- | ------- | ------------ | --------------------------------------- |
| `editor_getActive`           | `read`  | yes          | 获取 active editor、path、selection     |
| `editor_listOpenFiles`       | `read`  | yes          | 获取所有打开 editor                     |
| `editor_getSelection`        | `read`  | yes          | 获取当前 selection range 和选中文本     |
| `editor_readBuffer`          | `read`  | yes          | 读取 editor buffer 内容，包括未保存内容 |
| `editor_readRangeFromBuffer` | `read`  | yes          | 读取 buffer 指定范围，控制返回大小      |
| `editor_listDirtyFiles`      | `read`  | yes          | 列出未保存文件                          |
| `editor_getDirtyDiff`        | `read`  | yes          | 获取 buffer 相对磁盘文件的 diff         |
| `editor_open`                | `ui`    | yes          | 打开文件，可跳转行列                    |
| `editor_revealRange`         | `ui`    | yes          | 在 editor 中 reveal 指定范围            |
| `editor_setSelection`        | `ui`    | yes          | 设置 selection，辅助用户确认            |
| `editor_showDiff`            | `ui`    | yes          | 展示两个 URI 或 buffer 的 diff          |
| `editor_format`              | `write` | configurable | 格式化文档，可能修改内容                |
| `editor_save`                | `write` | configurable | 保存文件                                |
| `editor_applyEdit`           | `write` | no           | 对打开 buffer 应用编辑，需权限          |

设计重点：

- `readBuffer/readRangeFromBuffer/listDirtyFiles/getDirtyDiff` 是 Claude Code 场景的核心增量能力，因为文件系统工具看不到未保存 buffer。
- `open/reveal/setSelection/showDiff` 是 OpenSumi UI 呈现能力，应默认可用。
- 写入类 editor tool 不应绕过权限。

### 3. terminal

目标：让 agent 观察和协助用户已有 IDE terminal，也支持用户要求“在 OpenSumi 终端里运行命令并交互”的场景。

#### 观察层

默认暴露。

| Tool                      | Risk   | Default | 用途                                                |
| ------------------------- | ------ | ------- | --------------------------------------------------- |
| `terminal_list`           | `read` | yes     | 列出 IDE terminal sessions、active 状态、title、cwd |
| `terminal_getActive`      | `read` | yes     | 获取当前用户正在看的 terminal                       |
| `terminal_readOutput`     | `read` | yes     | 读取最近 N 行输出                                   |
| `terminal_tail`           | `read` | yes     | 从 cursor 后读取增量输出，适合长进程                |
| `terminal_getProcessInfo` | `read` | yes     | 获取 shell pid、cwd、当前进程状态                   |
| `terminal_getProfiles`    | `read` | yes     | 获取可用 terminal profiles                          |
| `terminal_getOS`          | `read` | yes     | 获取 terminal OS 信息                               |

`terminal_readOutput` 建议参数：

```ts
{
  id?: string;
  maxLines?: number;
  stripAnsi?: boolean;
  includeCommandEcho?: boolean;
}
```

`terminal_tail` 建议参数：

```ts
{
  id: string;
  cursor?: string;
  maxLines?: number;
}
```

#### 低风险交互层

可以默认暴露，但必须审计，产品上应支持配置是否每次确认。

| Tool                      | Risk    | Default      | 用途                                                 |
| ------------------------- | ------- | ------------ | ---------------------------------------------------- |
| `terminal_show`           | `ui`    | yes          | 聚焦 terminal                                        |
| `terminal_showPanel`      | `ui`    | yes          | 展示 terminal panel                                  |
| `terminal_resize`         | `ui`    | yes          | 调整 terminal 尺寸                                   |
| `terminal_sendText`       | `shell` | configurable | 向 terminal 输入文本，不自动回车                     |
| `terminal_sendControl`    | `shell` | configurable | 发送 allowlist 控制键，如 Enter、Ctrl-C、Tab、方向键 |
| `terminal_waitForPattern` | `read`  | yes          | 等待输出出现指定字符串或正则                         |

`terminal_sendControl` 只允许 allowlist：

- `enter`
- `ctrl-c`
- `ctrl-d`
- `escape`
- `tab`
- `up`
- `down`
- `left`
- `right`

#### 高风险执行层

用于用户明确希望命令在 OpenSumi 终端可见运行，并允许 agent 交互处理。

| Tool                      | Risk          | Default             | 用途                                     |
| ------------------------- | ------------- | ------------------- | ---------------------------------------- |
| `terminal_create`         | `shell/ui`    | configurable        | 创建 IDE terminal                        |
| `terminal_runCommand`     | `shell`       | configurable        | 在指定 terminal 输入命令并回车执行       |
| `terminal_executeCommand` | `shell`       | compat/configurable | 兼容现有工具，后续可由 `runCommand` 替代 |
| `terminal_dispose`        | `destructive` | no                  | 关闭 terminal session                    |

典型流程：

1. `terminal_create({ name, cwd })`
2. `terminal_show({ id })`
3. `terminal_runCommand({ id, command })`
4. 循环 `terminal_tail({ id, cursor })`
5. 根据输出决定 `terminal_sendText`、`terminal_sendControl` 或停止
6. 用 `terminal_waitForPattern` 判断 dev server、test watcher、REPL 是否进入目标状态

设计重点：

- `sendText` 默认不追加换行。
- `sendText` 和 `sendControl` 必须拆开，避免普通输入自动执行。
- 日志只记录 `terminalId`、`action`、`charCount`、`commandLength`，不打印命令和输入内容。
- `terminal_executeCommand` 不是核心增量能力，核心是 observation + controlled interaction。

### 4. diagnostics

目标：暴露 IDE/LSP problems，这是 Claude Code 通过 shell 不一定能即时获得的语义反馈。

| Tool                         | Risk   | Default | 用途                                               |
| ---------------------------- | ------ | ------- | -------------------------------------------------- |
| `diagnostics_list`           | `read` | yes     | 获取当前 diagnostics，支持文件、严重级别和数量过滤 |
| `diagnostics_getStats`       | `read` | yes     | 获取 diagnostics 按严重级别统计                    |
| `diagnostics_getForFile`     | `read` | yes     | 获取指定文件 diagnostics                           |
| `diagnostics_getRelatedInfo` | `read` | yes     | 获取 diagnostic related information                |
| `diagnostics_open`           | `ui`   | yes     | 打开并跳转到 diagnostic 位置                       |
| `diagnostics_watch`          | `read` | later   | 在一次任务中订阅 diagnostics 变化                  |

设计重点：

- diagnostics 应尽量反映 editor buffer 状态，而不只是磁盘文件。
- 返回内容要限制数量和 message 长度，避免大项目一次返回过多。

### 5. language

目标：暴露 LSP/语言服务语义能力，这是 IDE 对 Claude Code 的核心增量。

| Tool                         | Risk      | Default | 用途                                |
| ---------------------------- | --------- | ------- | ----------------------------------- |
| `language_workspaceSymbols`  | `read`    | yes     | 搜索 workspace symbols              |
| `language_documentSymbols`   | `read`    | yes     | 获取当前或指定文件 document symbols |
| `language_goToDefinition`    | `read/ui` | yes     | 查找定义，可选 reveal               |
| `language_findReferences`    | `read`    | yes     | 查找引用                            |
| `language_hover`             | `read`    | yes     | 获取 hover 信息、类型信息、文档     |
| `language_signatureHelp`     | `read`    | yes     | 获取函数签名帮助                    |
| `language_codeActions`       | `read`    | yes     | 获取可用 code actions，不直接执行   |
| `language_executeCodeAction` | `write`   | no      | 执行 code action，需权限            |
| `language_renamePreview`     | `read`    | yes     | 预览 rename 影响范围                |
| `language_rename`            | `write`   | no      | 执行 rename，需权限                 |

设计重点：

- `codeActions` 和 `renamePreview` 可以默认暴露，因为只读。
- 执行 code action / rename 会改代码，必须走权限。
- 返回 symbol/reference 时要支持 `maxResults`。

### 6. search

目标：提供 IDE 侧搜索能力。Claude Code 有 grep/rg，但 IDE search 对 open editors、exclude 设置、UI 结果呈现仍有价值。

| Tool                 | Risk   | Default | 用途                                                   |
| -------------------- | ------ | ------- | ------------------------------------------------------ |
| `search_files`       | `read` | yes     | 按文件名或路径片段搜索 workspace 文件                  |
| `search_text`        | `read` | yes     | 全文搜索，支持 include、exclude、大小写、整词和正则    |
| `search_openEditors` | `read` | yes     | 只搜索已打开 editor，包括未保存内容                    |
| `search_symbols`     | `read` | compat  | 兼容现有工具，后续可迁移到 `language_workspaceSymbols` |
| `search_showResults` | `ui`   | later   | 在 OpenSumi Search panel 展示搜索结果                  |

设计重点：

- 对 Claude Code 来说，`search_text` 不是唯一入口，不能把它设计成替代 grep。
- `search_openEditors` 更有 IDE 增量价值。

### 7. scm

目标：暴露 OpenSumi SCM 视图和 diff 呈现能力。git 命令本身 Claude Code 已有，但 IDE SCM 状态、资源组和 diff UI 有价值。

| Tool                  | Risk                | Default | 用途                                                      |
| --------------------- | ------------------- | ------- | --------------------------------------------------------- |
| `scm_status`          | `read`              | yes     | 获取 repositories、branch、resource groups、changed files |
| `scm_diff`            | `read`              | yes     | 获取指定文件 diff                                         |
| `scm_openChangedFile` | `ui`                | yes     | 打开变更文件                                              |
| `scm_showDiff`        | `ui`                | yes     | 在 IDE diff editor 展示变更                               |
| `scm_stage`           | `write`             | no      | stage 文件                                                |
| `scm_unstage`         | `write`             | no      | unstage 文件                                              |
| `scm_commit`          | `write`             | no      | 提交变更                                                  |
| `scm_push`            | `shell/destructive` | no      | push 到远端                                               |

设计重点：

- 默认暴露 SCM read + UI。
- stage/commit/push 不默认暴露，避免和 Claude Code git 能力重复且风险高。

### 8. debug

目标：暴露 IDE debug session 状态和调用栈。启动/停止 debug 会影响进程，默认谨慎。

| Tool                 | Risk          | Default      | 用途                                |
| -------------------- | ------------- | ------------ | ----------------------------------- |
| `debug_listSessions` | `read`        | yes          | 获取 debug sessions                 |
| `debug_getState`     | `read`        | yes          | 获取当前 session 状态               |
| `debug_stackTrace`   | `read`        | yes          | 获取线程和调用栈                    |
| `debug_variables`    | `read`        | yes          | 获取变量，默认限制层级和数量        |
| `debug_evaluate`     | `shell/write` | no           | 在 debug context 求值，可能有副作用 |
| `debug_continue`     | `ui`          | configurable | 控制调试流程                        |
| `debug_stepOver`     | `ui`          | configurable | 单步跳过                            |
| `debug_stepInto`     | `ui`          | configurable | 单步进入                            |
| `debug_pause`        | `ui`          | configurable | 暂停                                |
| `debug_start`        | `shell`       | no           | 启动 debug session                  |
| `debug_stop`         | `destructive` | no           | 停止 debug session                  |

设计重点：

- 变量读取必须限制数量、深度、字符串长度。
- `evaluate` 可能执行代码，不能当 read tool。

### 9. tasks

目标：暴露 IDE task 系统。Claude Code 可直接跑命令，但 OpenSumi task 有用户配置、problem matcher 和 UI 状态。

| Tool               | Risk          | Default      | 用途               |
| ------------------ | ------------- | ------------ | ------------------ |
| `tasks_list`       | `read`        | yes          | 列出可运行 tasks   |
| `tasks_getActive`  | `read`        | yes          | 获取正在运行 tasks |
| `tasks_run`        | `shell`       | configurable | 运行指定 task      |
| `tasks_terminate`  | `destructive` | no           | 终止 task          |
| `tasks_showOutput` | `ui`          | yes          | 展示 task 输出     |

设计重点：

- `tasks_run` 需要展示将运行的 task label/source。
- task 输出读取可复用 terminal/output channel 能力。

### 10. output

目标：读取 OpenSumi output channels、extension logs、language server logs。很多报错不会出现在 terminal。

| Tool                  | Risk   | Default | 用途                       |
| --------------------- | ------ | ------- | -------------------------- |
| `output_listChannels` | `read` | yes     | 列出 output channels       |
| `output_readChannel`  | `read` | yes     | 读取指定 channel 最近 N 行 |
| `output_tailChannel`  | `read` | yes     | 增量读取 output channel    |
| `output_showChannel`  | `ui`   | yes     | 展示 output panel          |

设计重点：

- 默认 strip ANSI、限制 maxLines。
- 不读取敏感 channel，或做 channel allowlist/denylist。

### 11. problems and quick fixes

目标：在 diagnostics 之上，暴露问题修复建议和安全应用路径。

| Tool               | Risk    | Default | 用途                                        |
| ------------------ | ------- | ------- | ------------------------------------------- |
| `quickfix_list`    | `read`  | yes     | 获取某个 diagnostic 或 range 的 quick fixes |
| `quickfix_preview` | `read`  | yes     | 预览 quick fix workspace edit               |
| `quickfix_apply`   | `write` | no      | 应用 quick fix                              |

设计重点：

- 默认只读 preview。
- apply 必须权限确认，并返回受影响文件列表。

### 12. commands

目标：作为 escape hatch，只暴露 allowlist 中的 OpenSumi command。

| Tool                      | Risk             | Default | 用途                       |
| ------------------------- | ---------------- | ------- | -------------------------- |
| `commands_listAllowed`    | `read`           | yes     | 列出 agent 可调用 commands |
| `commands_executeAllowed` | `ui/write/shell` | no      | 执行 allowlist command     |

设计重点：

- 禁止暴露任意 command id。
- 每个 allowlist command 必须登记 risk、参数 schema 和权限策略。

### 13. notifications and prompts

目标：在必要时与用户确认或展示信息。不要让 agent 用它替代正常回复。

| Tool               | Risk | Default      | 用途                       |
| ------------------ | ---- | ------------ | -------------------------- |
| `ui_showMessage`   | `ui` | configurable | 展示通知                   |
| `ui_showQuickPick` | `ui` | configurable | 请求用户从选项中选择       |
| `ui_showInputBox`  | `ui` | no           | 请求用户输入，容易打断流程 |
| `ui_focusPanel`    | `ui` | yes          | 聚焦 panel                 |

设计重点：

- 这些工具可能打扰用户，默认需要节制。
- 用户确认优先走 ACP permission routing，而不是让 agent 自己弹任意输入框。

### 14. extensions

目标：读取插件状态和相关日志。安装、卸载、启停插件风险高。

| Tool                   | Risk          | Default      | 用途                |
| ---------------------- | ------------- | ------------ | ------------------- |
| `extensions_list`      | `read`        | yes          | 获取已安装/启用插件 |
| `extensions_getStatus` | `read`        | yes          | 获取插件状态        |
| `extensions_readLog`   | `read`        | configurable | 读取插件相关日志    |
| `extensions_enable`    | `write`       | no           | 启用插件            |
| `extensions_disable`   | `write`       | no           | 禁用插件            |
| `extensions_install`   | `shell/write` | no           | 安装插件            |

### 15. acp_chat

目标：暴露 ACP Chat 自身的安全运行态，帮助 agent 判断当前 OpenSumi chat 会话、thread status 和 permission 等待情况。

这组能力的边界比 IDE terminal/editor 更窄。Claude Code agent 正运行在 ACP Chat 会话内，因此不应该让它通过 WebMCP 再向同一个 chat 发消息、自动批准自己的权限请求，或清空/切换用户会话。

| Tool | Risk | Default | 用途 |
| --- | --- | --- | --- |
| `acp_chat_getSessionState` | `read` | yes | 获取 active ACP session 的元信息、threadStatus、request/history 计数，不返回 prompt/response 内容 |
| `acp_chat_getPermissionState` | `read` | yes | 获取 pending permission 数量、active session id，不返回 permission 内容，不做决策 |
| `acp_chat_showChatView` | `ui` | yes | 展示 ACP chat panel |
| `acp_chat_listSessions` | `read` | on enable | 列出 ACP sessions 元信息，不返回对话内容 |
| `acp_chat_getAvailableCommands` | `read` | on enable | 获取当前 ACP session 可用 slash commands |
| `acp_chat_setSessionMode` | `write` | full only | 切换 ACP session mode，会改变 agent 行为，仅 full profile 可用 |

不注册到新 group 的旧 ACP 能力：

| Legacy Tool                               | 结论   | 原因                                                    |
| ----------------------------------------- | ------ | ------------------------------------------------------- |
| `acp_sendMessage`                         | 不注册 | 容易让 agent 在自己的 chat loop 内递归发消息            |
| `acp_handlePermissionDialog`              | 不注册 | 不能让 agent 自动批准或拒绝自己的权限请求               |
| `acp_clearSession`                        | 不注册 | 会清除用户会话上下文，属于 destructive chat 操作        |
| `acp_createSession` / `acp_switchSession` | 不注册 | 对 Claude Code 当前任务收益低，容易改变用户正在看的会话 |
| `acp_cancelRequest`                       | 不注册 | 可能中断当前 agent 自己的执行链路                       |

设计重点：

- 返回会话 metadata 和计数，不返回用户 prompt、assistant response、tool call result 内容。
- permission 能力只观测，不决策；用户确认仍走 ACP permission routing。
- `showChatView` 是 UI 呈现能力，可以默认暴露。
- `setSessionMode` 是行为配置变更，按 `write` 处理，只在 `full` profile 中可启用。

#### 手动跨会话转发

目标：支持用户把某个 ACP 会话作为“主会话/聊天室”，由 agent 在用户明确要求时读取其他会话的受限摘要，并把整理后的内容投递到主会话。

这不是长期会话连接，不做后台同步，也不做 `Session link`。每次跨会话通信都应该是一次性、显式、可审计的 relay。

建议新增工具：

| Tool | Risk | Default | 用途 |
| --- | --- | --- | --- |
| `acp_chat_prepareSessionDigest` | `read` | on enable | 在后台为指定会话准备摘要，返回 `digestId` 和短 preview，不把源会话原文返回给当前 agent |
| `acp_chat_postPreparedRelay` | `write` | full only + permission | 将已准备好的 digest 投递到目标会话 |
| `acp_chat_readSessionMessages` | `read` | full only | 调试/兜底能力：读取指定会话最近 N 条消息，强限制数量和总字符数 |

优先实现顺序：

1. `acp_chat_prepareSessionDigest`
2. `acp_chat_postPreparedRelay`
3. `acp_chat_readSessionMessages`

`readSessionMessages` 最容易撑爆 context，也更容易带出敏感内容，因此不作为第一阶段必需能力。正常 relay 流程中，当前主会话 agent 不应该直接看到源会话 recent excerpts，只应该看到 digest metadata、短 preview 和投递结果。

`acp_chat_prepareSessionDigest` 建议 schema：

```ts
{
  sourceSessionId: string;
  maxSourceChars?: number; // default 12000, cap 30000
  maxDigestChars?: number; // default 2000, cap 6000
}
```

返回给当前 agent：

```ts
{
  digestId: string;
  sourceSessionId: string;
  sourceTitle: string;
  digestSource: 'memory_summary' | 'background_summary' | 'empty';
  preview: string; // short preview only, e.g. first 300 chars of digest
  digestChars: number;
  sourceChars: number;
  sourceTruncated: boolean;
  expiresAt: number;
}
```

浏览器侧 relay store 缓存完整 digest：

```ts
{
  digestId: string;
  sourceSessionId: string;
  sourceTitle: string;
  digest: string;
  createdAt: number;
  expiresAt: number;
}
```

`digestId` 缓存在浏览器侧 ACP Chat relay store 中，TTL 建议 10 分钟。当前主会话 agent 只拿到 `digestId` 和短 preview，拿不到源会话原文，也拿不到完整 digest，避免污染主会话上下文。

后台摘要生成策略：

1. 优先使用 `session.history.getMemorySummaries()`。
2. 如果已有 memory summary，按时间顺序合并并裁剪到 `maxDigestChars`，`digestSource='memory_summary'`。
3. 如果没有 memory summary，从源会话提取受限 source material：
   - 最近少量 user/assistant 消息。
   - 每条内容截断，例如 800 chars。
   - 总输入限制，例如 default 12000 chars、cap 30000 chars。
   - 不包含 tool result 原文。
   - tool call 只保留工具名、状态、错误码，不保留结果内容。
4. 使用独立 summarizer 在后台生成 digest，不把 source material 返回给当前 agent，不写入当前主会话 history。
5. 如果 summarizer 不可用，返回 `digestSource='empty'` 或空摘要，不降级为把源会话摘录返回给当前 agent。

后台 summarizer 实现建议：

- 使用独立的 `AcpChatRelaySummaryProvider`，不要复用面向 chat title 的 `MessageSummaryProvider` 作为主路径。
- Provider 优先读取 `session.history.getMemorySummaries()`，已有 memory summary 时不再调用模型。
- 没有 memory summary 时，Provider 从源会话构造受限 messages，再调用 `AIBackService.request`。
- 请求 `type` 使用 `acp_chat_relay_summary`，并设置 `noTool: true`，避免后台摘要触发工具调用。
- summarizer 调用使用独立 request id 和日志标签，例如 `acp_chat_prepare_digest`。
- summarizer 结果只写入 relay store，不追加到任何 ChatModel 的 `history`。
- relay 链路日志记录 `prepare start/done/miss/error`、`summary request start/done/error`、`post start/miss/permission request/permission result/denied/session switch/message sent/session restored/done/error`。
- 日志字段只记录 `sourceSessionId`、`targetSessionId`、`digestId`、`requestId`、`digestSource`、`historyMessages`、`memorySummaries`、`sourceChars`、`digestChars`、`sourceTruncated`、`messageChars`、`switchedSession`、`durationMs`、`reason/errorName`，不打印摘要内容、prompt、源消息正文或投递正文。
- 如果 `AIBackService.request` 在当前 ACP agent 后端不可用，Provider 返回 `digestSource='empty'`，不要降级为把源会话摘录返回给当前 agent。

伪代码：

```ts
async function prepareSessionDigest(sourceSessionId, limits) {
  const session = await loadAcpSession(sourceSessionId);
  const summaryProvider = injector.get(AcpChatRelaySummaryProvider);
  const summary = await summaryProvider.prepareSessionDigest(session, limits);

  return relayStore.put({
    sourceSessionId,
    digestSource: summary.digestSource,
    digest: summary.digest,
    sourceChars: summary.sourceChars,
    digestChars: summary.digestChars,
    sourceTruncated: summary.sourceTruncated,
  });
}
```

`acp_chat_readSessionMessages` 建议 schema：

```ts
{
  sessionId: string;
  maxMessages?: number; // default 10, cap 30
  maxChars?: number; // default 4000, cap 12000
  sinceRequestId?: string;
}
```

返回：

```ts
{
  sessionId: string;
  title: string;
  requestCount: number;
  historyMessageCount: number;
  messages: Array<{
    role: 'user' | 'assistant';
    contentPreview: string;
    chars: number;
    truncated: boolean;
  }>;
  truncated: boolean;
}
```

`readSessionMessages` 只能作为 full profile 下的显式调试/兜底工具，不参与默认 relay 流程。

`acp_chat_postPreparedRelay` 建议 schema：

```ts
{
  digestId: string;
  targetSessionId: string;
}
```

执行策略：

- 必须触发权限确认。
- 从 relay store 读取 `digestId` 对应的完整 digest。
- 只投递文本，不支持 images。
- digest 长度限制，例如 cap 6000 chars。
- 自动包装来源说明：

```md
[Forwarded from ACP session: <sourceTitle or sourceSessionId>]

<digest>
```

如果目标 session 不是当前 active session，第一阶段建议采用“临时切换目标会话、发送后切回原会话”的实现，改动较小；实现时必须用 `finally` 保证切回原 session。

权限确认文案应展示：

- source session
- target session
- digest 字符数
- digest preview 前 500 chars
- 是否会临时切换会话

用户选项只提供：

- Allow once
- Reject

不要提供 `allow always`，避免 agent 后续自动跨会话灌消息。

Profile 策略：

- `acp_chat_prepareSessionDigest`: `profiles: ['interactive', 'full']`
- `acp_chat_postPreparedRelay`: `riskLevel: 'write'`、`profiles: ['full']`、执行时强 permission
- `acp_chat_readSessionMessages`: `profiles: ['full']`

典型流程：

1. 用户在主会话说：“把会话 2 的进展同步过来。”
2. agent 调用 `acp_chat_listSessions`。
3. agent 调用 `acp_chat_prepareSessionDigest({ sourceSessionId })`。
4. 工具在后台准备摘要，返回 `digestId` 和短 preview。
5. agent 调用 `acp_chat_postPreparedRelay({ digestId, targetSessionId })`。
6. OpenSumi 弹出权限确认。
7. 用户确认后，内容投递到主会话。

明确不做：

- 不做 `linkSessions`。
- 不做后台自动同步。
- 不做自动 permission approve。
- 不默认读取完整历史。
- 不把其他会话的 tool result 原样转发。

## Current Implementation Mapping

当前已实现的组：

| Group | 已实现工具 | 评估 |
| --- | --- | --- |
| `workspace` | `getInfo`、`listOpenFiles`、`listRecentWorkspaces` | 保留 |
| `search` | `files`、`text`、`symbols` | 保留，`symbols` 后续迁移到 language group |
| `diagnostics` | `list`、`getStats`、`open` | 保留，补 `getForFile`、related info |
| `file` | read/write/list/stat/exists/create/delete/move/copy | 已补 `riskLevel`；写入和 destructive 工具默认不暴露 |
| `editor` | open/close/getActive/listOpenFiles/getSelection/readBuffer/readRangeFromBuffer/listDirtyFiles/getDirtyDiff/setSelection/format/fold/unfold/save | 保留 read/UI 能力；format/save 默认不暴露 |
| `terminal` | list/getActive/readOutput/tail/getProcessInfo/create/executeCommand/sendText/sendControl/runCommand/waitForPattern/show/getProcessId/dispose/resize/getOS/getProfiles/showPanel | 已拆成 observation + interaction；dispose 默认不暴露 |
| `acp_chat` | getSessionState/getPermissionState/showChatView/listSessions/getAvailableCommands/prepareSessionDigest/postPreparedRelay/readSessionMessages/setSessionMode | 已补跨会话 relay；默认只暴露安全观测和 chat panel 展示，不暴露 sendMessage/permission 决策；prepare 仅 interactive/full，post/read 仅 full |
| `opensumi` | discoverCapabilities/describeCapabilityGroup/describeTool/enableCapabilityGroup/invokeCapabilityTool | Capability Catalog 已实现，用于默认小工具集下的自主发现、按需启用和 fallback broker |

兼容说明：

- 旧的 `registerAcpWebMCPTools` 直连注册实现已删除。
- ACP Chat 运行时 WebMCP 能力统一由 `acp_chat` group 注册和暴露。

## Priority Plan

### P0: 调整默认暴露策略（已完成）

1. 给现有 `file/editor/terminal` 工具补 `riskLevel`。
2. 默认保留 `workspace/search/diagnostics/editor UI/terminal read`。
3. 将 `file_write/create/delete/move/copy`、`terminal_dispose` 标记为 `exposedByDefault: false`。
4. `terminal_executeCommand` 先兼容保留，新增 `terminal_runCommand/sendText/sendControl/readOutput/tail` 后再降级。

### P1: 补 Claude Code 最关键增量能力（已完成）

1. `editor_readBuffer`
2. `editor_readRangeFromBuffer`
3. `editor_listDirtyFiles`
4. `editor_getDirtyDiff`
5. `terminal_readOutput`
6. `terminal_tail`
7. `terminal_getActive`
8. `terminal_sendText`
9. `terminal_sendControl`
10. `terminal_waitForPattern`

### P2: 补 LSP 语义能力

1. `language_documentSymbols`
2. `language_goToDefinition`
3. `language_findReferences`
4. `language_hover`
5. `language_codeActions`
6. `quickfix_preview`

### P3: 补 IDE 运行态能力

1. `output_listChannels/readChannel/tailChannel`
2. `tasks_list/getActive/run`
3. `scm_status/diff/showDiff`
4. `debug_listSessions/stackTrace/variables`

### P4: 补 Capability Catalog（已完成）

1. 新增 `opensumi` catalog group。
2. 实现 `opensumi_discoverCapabilities`，只返回 group 摘要和推荐 next action。
3. 实现 `opensumi_describeCapabilityGroup`，默认返回工具列表和参数摘要。
4. 实现 `opensumi_describeTool`，只返回单个工具完整 schema。
5. 默认 profile 保留 core tools + catalog tools，继续收窄默认 `tools/list`。
6. 在 ACP session 初始 prompt 中加入能力探索提示。
7. 增加 catalog 漏斗日志。

实现说明：

- HTTP MCP server 以每个 MCP session 为单位维护 `enabledGroups`。
- `tools/list` 默认只暴露 `defaultLoaded` 且符合当前 profile 的工具，以及 catalog 元工具。
- `opensumi_enableCapabilityGroup` 会把 group 记录到当前 session，下一次 `tools/list` 会额外暴露该 group 在当前轻量规则下可见的工具。
- `default` profile 下，按需启用可以暴露默认列表中没有出现的工具，例如 search 或 terminal interaction；具体高风险动作仍应在工具执行时处理权限。
- `riskLevel` 目前主要用于描述、推荐、日志和后续策略演进，不应被理解为已经完成了一套强权限系统。
- `exposedByDefault` 当前是保留的隐藏开关，适合临时保护明显不希望进入普通 `tools/list` 的工具；是否长期保留，等真实调用数据稳定后再决定。
- `tools/list` 通过 browser RPC 获取 `includeAllTools` 定义，因此 catalog 能描述 default profile 未直接暴露的工具。

### P5: 验证动态启用和 fallback（已实现，待真实 Claude Code 行为验证）

1. 实现 `opensumi_enableCapabilityGroup`，按 session 记录 `enabledGroups`。
2. 验证 Claude Code agent 在 enable 后是否会重新 `tools/list`。
3. 如果会刷新 tools，优先使用原生 MCP tool 暴露。
4. 如果不会刷新 tools，补 `opensumi_invokeCapabilityTool` 作为 broker fallback。
5. 对 broker fallback 做参数校验、权限路由和审计，避免绕过高风险工具控制。

实现说明：

- `opensumi_enableCapabilityGroup` 返回 `refreshRequired: true`、`fallbackTool` 和 fallback 调用示例。
- `opensumi_invokeCapabilityTool` 只允许调用已经默认可见或已启用 group 中可暴露的工具。
- fallback 会记录 `capabilities/invokeTool` 日志，包含 tool、group、riskLevel、success，不记录参数内容。
- 单测已覆盖：默认不暴露 profile-hidden 工具、enable 后重新 `listTools` 可见、fallback broker 可调用已启用工具。

## 上下文预算观测

每次 `tools/list` 输出以下日志：

- `profile`
- `groups`
- `tools`
- `exposedTools`
- `schemaBytes`
- `descriptionBytes`
- `totalToolBytes`
- 每个 group 的工具数和字节数
- top 5 最大 tool definition

判断标准：

- `schemaBytes` 大：优先压缩 JSON Schema，减少复杂嵌套。
- `descriptionBytes` 大：优先压缩工具描述。
- `totalToolBytes` 随工具数量线性增长：考虑默认关闭、allowlist 或按需加载。

Claude Code 场景下，宁愿减少重复能力，也要保留 IDE 增量能力：

- 优先保留：editor buffer、terminal output、diagnostics、language navigation、UI reveal。
- 优先关闭：file write/delete、raw command execute、SCM write、debug evaluate、arbitrary commands。

## 日志与审计

所有非 read 工具都应有审计日志：

- tool name
- group
- riskLevel
- sessionId/threadId
- target resource path 或 terminalId
- charCount/commandLength，而不是具体命令或输入内容
- success/failure

禁止日志打印：

- prompt 原文
- terminal 输入内容
- 文件内容
- secret/token/password
- 完整 shell command，除非用户显式开启 debug 日志

## 维护规则

新增或修改 WebMCP tool 时，需要同步更新本文：

1. 登记 group、tool、risk、default 和用途。
2. 判断它是否是 Claude Code 已有能力；如果是重复能力，默认不应暴露，除非有 IDE 可见性或交互价值。
3. 如果是 `write`、`shell` 或 `destructive`，说明权限策略和审计字段。
4. 如果 schema 或 description 明显变大，记录 `tools/list` 日志中的字节数变化。
5. 对长输出工具必须提供 `maxLines`、`maxBytes`、`cursor` 或分页参数。
