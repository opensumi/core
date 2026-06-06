import { AIBackSerivcePath } from '@opensumi/ide-core-common';

import { createOpenSumiMcpGroup } from '../../src/browser/acp/webmcp-groups/opensumi-mcp.webmcp-group';

describe('OpenSumi MCP WebMCP group', () => {
  it('returns a stable built-in MCP connection descriptor from AIBackService', async () => {
    const connection = {
      name: 'opensumi-ide',
      type: 'http',
      transport: 'streamable-http',
      url: 'http://127.0.0.1:12345/mcp/token',
      redactedUrl: 'http://127.0.0.1:12345/mcp/<redacted>',
      headers: [],
    };
    const aiBackService = {
      getOpenSumiMcpServerConnection: jest.fn().mockResolvedValue(connection),
    };
    const group = createOpenSumiMcpGroup({
      get: jest.fn((token) => {
        if (token === AIBackSerivcePath) {
          return aiBackService;
        }
        throw new Error('unknown token');
      }),
    } as any);

    const result = await group.tools[0].execute({});

    expect(aiBackService.getOpenSumiMcpServerConnection).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      result: connection,
    });
  });

  it('returns SERVICE_UNAVAILABLE when AIBackService does not expose the connection method', async () => {
    const group = createOpenSumiMcpGroup({
      get: jest.fn(() => ({})),
    } as any);

    await expect(group.tools[0].execute({})).resolves.toMatchObject({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
    });
  });
});
