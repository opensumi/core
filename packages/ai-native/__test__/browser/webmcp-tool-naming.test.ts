import { createAcpChatGroup } from '../../src/browser/acp/webmcp-groups/acp-chat.webmcp-group';
import { createDiagnosticsGroup } from '../../src/browser/acp/webmcp-groups/diagnostics.webmcp-group';
import { createEditorGroup } from '../../src/browser/acp/webmcp-groups/editor.webmcp-group';
import { createFileGroup } from '../../src/browser/acp/webmcp-groups/file.webmcp-group';
import { createOpenSumiMcpGroup } from '../../src/browser/acp/webmcp-groups/opensumi-mcp.webmcp-group';
import { createSearchGroup } from '../../src/browser/acp/webmcp-groups/search.webmcp-group';
import { createTerminalGroup } from '../../src/browser/acp/webmcp-groups/terminal.webmcp-group';
import { createWorkspaceGroup } from '../../src/browser/acp/webmcp-groups/workspace.webmcp-group';

const LOWER_SNAKE_TOOL_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

describe('WebMCP tool naming contract', () => {
  it('registers only lower snake case external tool names', () => {
    const container = {} as any;
    const groups = [
      createOpenSumiMcpGroup(container),
      createWorkspaceGroup(container),
      createSearchGroup(container),
      createDiagnosticsGroup(container),
      createFileGroup(container),
      createTerminalGroup(container),
      createEditorGroup(container),
      createAcpChatGroup(container),
    ];

    const invalidToolNames = groups
      .flatMap((group) => group.tools.map((tool) => ({ group: group.name, name: tool.name })))
      .filter(({ name }) => !LOWER_SNAKE_TOOL_NAME.test(name) || name.includes('/') || /[A-Z]/.test(name));

    expect(invalidToolNames).toEqual([]);
  });
});
