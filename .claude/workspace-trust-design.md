# 工作区信任（受限模式）功能设计文档

## 概述

为 IDE 添加「工作区信任」机制，在首次打开项目时提示用户是否信任该项目目录。若用户选择「受限模式」，则 IDE 仅加载特定的安全插件，防止恶意脚本攻击。

## 背景

当前 IDE 打开项目时会自动加载并激活所有插件（extensions），包括第三方插件。如果项目目录来源不可信，其中的恶意插件脚本可能对用户的系统和数据造成威胁。VS Code 的「Workspace Trust」功能提供了类似的防护机制。

## 核心流程

```
用户打开项目目录
    │
    ├── 查询 globalStorage 中是否已记录该目录的信任状态
    │       │
    │       ├── 已记录 → 直接使用已有状态
    │       └── 未记录 → 弹出信任对话框
    │                       │
    │                       ├── 选择「信任」 → 记录为信任状态
    │                       └── 选择「受限模式」 → 记录为受限状态
    │
    ├── 根据信任状态决定是否加载插件
    │       │
    │       ├── 信任 → 加载所有插件
    │       └── 受限 → 仅加载白名单插件
    │
    └── 根据信任状态更新 UI
            │
            ├── 信任 → 正常 UI
            └── 受限 → 状态栏显示「受限模式」标识
```

## 数据设计

### 存储方案

使用 `globalStorage`（全局持久化存储）记录每个目录的信任状态。

存储 key 格式：`workspace_trust_state:<workspace_path>` 存储 value：`"trusted"` | `"restricted"`

例如：

```
workspace_trust_state:/Users/mahang/Workspace/ide/core = "trusted"
workspace_trust_state:/tmp/suspicious-project = "restricted"
```

### 存储模块

使用 `STORAGE_NAMESPACE.GLOBAL_EXTENSIONS` 全局存储空间，以 key-value 形式持久化。

### 信任白名单插件

受限模式下仅允许加载以下插件（可通过配置扩展）：

- `vscode.theme-defaults` - 默认主题
- `vscode.typescript-language-features` - TypeScript 语言服务
- `common-extension` - 通用扩展

## 模块设计

### 新增模块：`workspace-trust`

在 `packages/workspace-trust/` 下创建新模块：

#### 文件结构

```
packages/workspace-trust/
├── package.json
├── src/
│   ├── common/
│   │   └── index.ts          # 公共常量和类型定义
│   └── browser/
│       ├── index.ts                  # 模块入口，BrowserModule 定义
│       ├── workspace-trust.service.ts    # WorkspaceTrustService
│       ├── workspace-trust.contribution.ts  # ClientAppContribution, 信任对话框
│       └── workspace-trust-statusbar.contribution.ts  # 状态栏「受限模式」标识
```

#### `WorkspaceTrustService` 核心方法

| 方法 | 说明 |
| --- | --- |
| `getTrustState(workspacePath: string): WorkspaceTrustState \| undefined` | 获取指定工作区路径的信任状态 |
| `setTrustState(workspacePath: string, state: WorkspaceTrustState): Promise<void>` | 设置并持久化信任状态 |
| `isRestricted(): boolean` | 当前工作区是否处于受限模式 |
| `showTrustDialog(): Promise<WorkspaceTrustState>` | 弹出信任选择对话框 |
| `ensureTrustDecided(): Promise<void>` | 确保当前工作区已有信任决定（如没有则弹窗） |
| `getAllowedExtensionIds(): string[]` | 受限模式下允许加载的插件 ID 白名单 |

#### `WorkspaceTrustContribution`

实现 `ClientAppContribution` 接口：

- `initialize()`: 检查当前工作区的信任状态，如果未决定则弹出信任对话框
  - 此方法在 `ExtensionClientAppContribution.initialize()` 之前执行（通过模块依赖保证）

#### `WorkspaceTrustStatusbarContribution`

- 在受限模式下，于状态栏右侧显示「受限模式」标识
- 点击可跳转到设置页面解除受限模式

## 集成点

### 1. 信任检查时机

`WorkspaceTrustContribution.initialize()` 在 app 启动的 `initialize` 阶段执行。此时：

1. 获取当前工作区路径（从 `AppConfig.workspaceDir`）
2. 查询 globalStorage 中是否已有信任状态
3. 如果没有，弹出信任对话框，等待用户选择
4. 将用户的决定写入 globalStorage

### 2. 插件过滤时机

修改 `ExtensionServiceImpl.initExtensionMetaData()`，在获取到所有插件元数据后：

1. 检查 `WorkspaceTrustService.isRestricted()`
2. 如果是受限模式，过滤 `extensionMetaDataArr`，仅保留白名单中的插件

### 3. 状态栏显示

`WorkspaceTrustStatusbarContribution` 在 `onStart()` 阶段：

1. 检查 `WorkspaceTrustService.isRestricted()`
2. 如果是受限模式，在状态栏右侧添加「受限模式」元素

## 模块依赖

```
workspace-trust → extension (依赖关系：workspace-trust 模块需要在 extension 之前初始化)
workspace-trust → workspace (获取工作区路径)
```

## 后续扩展

- 在设置页面添加「管理工作区信任」入口，允许用户修改已有工作区的信任状态
- 支持更多类型的白名单插件配置
- 受限模式下禁用终端、调试等可能存在安全风险的功能
