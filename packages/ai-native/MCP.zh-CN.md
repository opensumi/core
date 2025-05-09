# 模型控制协议（MCP）文档

## 概述

模型控制协议（Model Control Protocol，简称 MCP）是一个集成层，它使 IDE 的功能能够通过标准化接口暴露给 AI 模型。它提供了一组工具，允许 AI 模型与 IDE 环境交互，操作文件，并执行各种操作。

## 架构

组件关系图：

```
                                  ┌──────────────────────┐
                                  │   MCP服务器管理器      │
                                  │  (每个浏览器标签页)     │
                                  └─────────┬────────────┘
                                            │
                                            │ 管理
                                            ▼
┌─────────────────────┐           ┌───────────────────┐
│  MCP服务器注册表      │◄──────────┤    内置/外部       │
│   (前端代理)          │  注册工具  │   MCP服务器        │
└─────────┬───────────┘           └───────────────────┘
          │
          │ 转发
          ▼
┌─────────────────────┐           ┌─────────────────────────┐
│   Sumi MCP后端      │◄──────────┤  工具调用注册表管理器       │
│ (浏览器<->Node.js)  │   使用     │  (每个浏览器 tab一个注册表)  │
└─────────┬───────────┘           └─────────────┬───────────┘
          │                                     │
          │ 执行                                │ 管理
          ▼                                    ▼
┌─────────────────────┐           ┌─────────────────────────┐
│     工具处理器        │           │     工具调用注册表       │
│     (具体实现)        │           │     (可用工具集合)      │
└─────────────────────┘           └─────────────────────────┘
```

### 核心组件

1. **MCP 服务器管理器（MCPServerManager）**

   - 管理多个 MCP 服务器
   - 处理工具注册和调用
   - 维护服务器生命周期（启动/停止）
   - 每个浏览器标签页都有自己的 MCPServerManager 实例

2. **MCP 服务器注册表（MCPServerRegistry）**

   - MCP 的前端代理服务
   - 注册和管理 MCP 工具
   - 处理工具调用

3. **Sumi MCP 服务器后端（SumiMCPServerBackend）**

   - 连接浏览器和 Node.js 层的后端服务
   - 管理工具注册和调用
   - 处理前端和后端之间的通信

4. **工具调用注册表（ToolInvocationRegistry）**

   - 为 Agent 提供的所有可用函数调用的注册表
   - 管理工具的注册和查找
   - 维护工具 ID 到实现的映射
   - 支持工具的注册、获取和注销

5. **工具调用注册表管理器（ToolInvocationRegistryManager）**
   - 管理多个 ToolInvocationRegistry 实例
   - 每个实例与特定的 clientId 关联
   - 提供注册表的创建、获取和移除功能
   - 确保不同客户端上下文之间的隔离

### 服务器类型

1. **内置 MCP 服务器**

   - 提供核心 IDE 功能
   - 直接集成到 IDE 中

2. **外部 MCP 服务器**
   - 可以动态添加
   - 通过名称、命令、参数和环境变量进行配置

## 可用工具

MCP 系统为文件和 IDE 操作提供了几个内置工具：

### 文件操作

- `readFile`：读取文件内容，支持行范围
- `listDir`：列出目录内容
- `createNewFileWithText`：创建带有指定内容的新文件
- `findFilesByNameSubstring`：按名称搜索文件
- `getFileTextByPath`：通过路径获取文件内容
- `replaceOpenEditorFile`：替换当前编辑器中的内容
- `replaceOpenEditorFileByDiffPreviewer`：使用差异预览替换内容

### 编辑器操作

- `getCurrentFilePath`：获取当前打开文件的路径
- `getSelectedText`：获取当前选中的文本
- `getOpenEditorFileText`：获取打开编辑器中的文本

### 诊断

- `getDiagnosticsByPath`：获取特定文件的诊断信息
- `getOpenEditorFileDiagnostics`：获取打开编辑器的诊断信息

## 工具结构

每个 MCP 工具都遵循标准结构：

```typescript
interface MCPTool {
  name: string; // 工具名称
  description: string; // 工具描述
  inputSchema: any; // 输入模式
  providerName: string; // 提供者名称
}

interface MCPToolDefinition {
  name: string; // 工具名称
  description: string; // 工具描述
  inputSchema: any; // 输入模式
  handler: (
    args: any,
    logger: MCPLogger,
  ) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}
```

## 使用示例

### 注册新工具

```typescript
@Domain(MCPServerContribution)
export class MyCustomTool implements MCPServerContribution {
  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool({
      name: 'my_custom_tool',
      description: '工具功能描述',
      inputSchema: zodToJsonSchema(myInputSchema),
      handler: async (args, logger) => {
        // 工具实现
        return {
          content: [{ type: 'text', text: '结果' }],
        };
      },
    });
  }
}
```

### 添加外部 MCP 服务器 - 配置

在 IDE 的设置中，你可以通过 `ai.native.mcp.servers` 配置项添加外部 MCP 服务器。配置格式如下：

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "服务器名称",
      "command": "执行命令",
      "args": ["命令参数"],
      "env": {
        "环境变量名": "环境变量值"
      }
    }
  ]
}
```

示例配置：

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "env": {}
    }
  ]
}
```

## 最佳实践

1. **工具实现**

   - 始终使用模式（如 Zod）验证输入
   - 提供清晰的错误消息
   - 使用日志记录器进行调试和跟踪
   - 优雅地处理错误

2. **服务器管理**

   - 仅在需要时初始化服务器
   - 停止服务器时清理资源
   - 正确处理服务器生命周期事件

3. **工具使用**
   - 使用前检查工具可用性
   - 处理工具调用错误
   - 为特定任务使用适当的工具
   - 考虑性能影响（例如，读取整个文件与读取行范围）

## 错误处理

工具应该以标准格式返回错误：

```typescript
{
  content: [{
    type: 'text',
    text: 'Error: <错误消息>'
  }],
  isError: true
}
```

## 安全注意事项

1. 验证所有输入参数
2. 将文件系统访问限制在工作区内
3. 适当处理敏感信息
4. 验证外部服务器配置
