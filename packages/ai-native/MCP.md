# Model Control Protocol (MCP) Documentation

## Overview

The Model Control Protocol (MCP) is an integration layer that enables IDE capabilities to be exposed to AI models through a standardized interface. It provides a set of tools that allow AI models to interact with the IDE environment, manipulate files, and perform various operations.

## Architecture

Component Relationships:

```
                                  ┌─────────────────────┐
                                  │   MCPServerManager  │
                                  │  (Per Browser Tab)  │
                                  └─────────┬───────────┘
                                           │
                                           │ manages
                                           ▼
┌─────────────────────┐           ┌───────────────────┐
│  MCPServerRegistry  │◄──────────┤  Builtin/External │
│   (Frontend Proxy)  │  register │    MCP Servers    │
└─────────┬───────────┘    tools  └───────────────────┘
          │
          │ forwards
          ▼
┌─────────────────────┐           ┌─────────────────────────────┐
│ SumiMCPServerBackend│◄──────────┤ ToolInvocationRegistryManager│
│  (Browser<->Node.js)│   uses    │    (Registry per Client)     │
└─────────┬───────────┘           └─────────────┬───────────────┘
          │                                     │
          │ executes                           │ manages
          ▼                                    ▼
┌─────────────────────┐           ┌─────────────────────────┐
│    Tool Handlers    │           │  ToolInvocationRegistry │
│  (Implementation)   │           │   (Available Tools)      │
└─────────────────────┘           └─────────────────────────┘
```

### Core Components

1. **MCPServerManager**

   - Manages multiple MCP servers
   - Handles tool registration and invocation
   - Maintains server lifecycle (start/stop)
   - Each browser tab has its own MCPServerManager instance

2. **MCPServerRegistry**

   - Frontend proxy service for MCP
   - Registers and manages MCP tools
   - Handles tool invocations

3. **SumiMCPServerBackend**

   - Backend service that bridges browser and Node.js layers
   - Manages tool registration and invocation
   - Handles communication between frontend and backend

4. **ToolInvocationRegistry**

   - Registry for all available function calls for agents
   - Manages tool registration and lookup
   - Maintains a map of tool IDs to their implementations
   - Supports tool registration, retrieval, and unregistration

5. **ToolInvocationRegistryManager**
   - Manages multiple ToolInvocationRegistry instances
   - Each instance is associated with a specific clientId
   - Provides registry creation, retrieval, and removal
   - Ensures isolation between different client contexts

### Server Types

1. **Builtin MCP Server**

   - Provides core IDE capabilities
   - Integrated directly into the IDE

2. **External MCP Servers**
   - Can be added dynamically
   - Configured with name, command, args, and environment variables

## Available Tools

The MCP system provides several built-in tools for file and IDE operations:

### File Operations

- `readFile`: Read contents of a file with line range support
- `listDir`: List contents of a directory
- `createNewFileWithText`: Create a new file with specified content
- `findFilesByNameSubstring`: Search for files by name
- `getFileTextByPath`: Get the content of a file by path
- `replaceOpenEditorFile`: Replace content in the current editor
- `replaceOpenEditorFileByDiffPreviewer`: Replace content with diff preview

### Editor Operations

- `getCurrentFilePath`: Get path of current open file
- `getSelectedText`: Get currently selected text
- `getOpenEditorFileText`: Get text from open editor

### Diagnostics

- `getDiagnosticsByPath`: Get diagnostics for a specific file
- `getOpenEditorFileDiagnostics`: Get diagnostics for open editor

## Tool Structure

Each MCP tool follows a standard structure:

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  providerName: string;
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (
    args: any,
    logger: MCPLogger,
  ) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}
```

## Usage Examples

### Registering a New Tool

```typescript
@Domain(MCPServerContribution)
export class MyCustomTool implements MCPServerContribution {
  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool({
      name: 'my_custom_tool',
      description: 'Description of what the tool does',
      inputSchema: zodToJsonSchema(myInputSchema),
      handler: async (args, logger) => {
        // Tool implementation
        return {
          content: [{ type: 'text', text: 'Result' }],
        };
      },
    });
  }
}
```

### Adding External MCP Server - Configuration

You can add external MCP servers through the `ai.native.mcp.servers` configuration in IDE settings. The configuration format is as follows:

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "server-name",
      "command": "command-to-execute",
      "args": ["command-arguments"],
      "env": {
        "ENV_VAR_NAME": "env-var-value"
      }
    }
  ]
}
```

Example configuration:

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

### Adding You.com Search and Content Extraction

You.com provides MCP server support with web search, content extraction, and research capabilities that integrate seamlessly with OpenSumi. The You.com MCP server supports both authenticated and keyless operation.

#### Configuration

Add You.com MCP server to your OpenSumi configuration:

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "youcom-search",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@youdotcom-oss/mcp"],
      "enabled": true,
      "env": {
        "YDC_API_KEY": "your-api-key-here"
      }
    }
  ]
}
```

For keyless operation (100 free searches/day):

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "youcom-search",
      "type": "stdio", 
      "command": "npx",
      "args": ["-y", "@youdotcom-oss/mcp"],
      "enabled": true,
      "env": {
        "YDC_PROFILE": "free"
      }
    }
  ]
}
```

Alternatively, you can use the hosted You.com MCP server directly:

```json
{
  "ai.native.mcp.servers": [
    {
      "name": "youcom-web",
      "type": "sse",
      "url": "https://api.you.com/mcp",
      "enabled": true,
      "transportOptions": {
        "authProvider": {
          "token": "your-api-key-here"
        }
      }
    }
  ]
}
```

#### Available Tools

The You.com MCP server provides these tools for AI-powered development:

- **`you-search`**: Current web search with snippets and citations
- **`you-contents`**: Extract and read content from specific URLs  
- **`you-research`**: Synthesized research with cited sources

#### Usage Examples

**Web Search for Current Information:**
```typescript
// Search for latest TypeScript features
const results = await mcpClient.callTool('you-search', {
  query: 'TypeScript 5.8 new features',
  count: 10,
  freshness: 'week'
});
```

**Content Extraction:**
```typescript
// Read documentation from a specific URL
const content = await mcpClient.callTool('you-contents', {
  url: 'https://docs.example.com/api-reference',
  format: 'markdown'
});
```

**Research with Citations:**
```typescript
// Get researched summary with sources
const research = await mcpClient.callTool('you-research', {
  query: 'React Server Components best practices 2024',
  source_control: { limit: 5 }
});
```

#### Authentication Options

1. **API Key (Recommended for Development):**
   - Get your free API key at [you.com/platform/api-keys](https://you.com/platform/api-keys)
   - Set `YDC_API_KEY` in the server environment variables
   - Higher quotas and enhanced features

2. **Keyless Operation:**
   - No API key required for testing
   - 100 free searches per day per IP address  
   - Perfect for evaluation and prototyping

3. **x402 Payment Protocol (Future):**
   - Micropayment-based usage for production workloads
   - Pay-per-use with automatic retry handling

#### Error Handling

The You.com MCP server provides standard error logging and startup exception handling:

- **Startup Errors:** Server initialization issues are captured and logged
- **Tool Invocation Errors:** Individual tool failures are logged with context
- **Network Issues:** Connection problems are logged for debugging

Errors are logged through the standard MCP logging system and don't interrupt IDE functionality. Check the IDE's MCP server logs for troubleshooting information.

## Best Practices

1. **Tool Implementation**

   - Always validate input using schemas (e.g., Zod)
   - Provide clear error messages
   - Use the logger for debugging and tracking
   - Handle errors gracefully

2. **Server Management**

   - Initialize servers only when needed
   - Clean up resources when servers are stopped
   - Handle server lifecycle events properly

3. **Tool Usage**
   - Check tool availability before use
   - Handle tool invocation errors
   - Use appropriate tools for specific tasks
   - Consider performance implications (e.g., reading entire files vs. line ranges)

## Error Handling

Tools should return errors in a standardized format:

```typescript
{
  content: [{
    type: 'text',
    text: 'Error: <error message>'
  }],
  isError: true
}
```
