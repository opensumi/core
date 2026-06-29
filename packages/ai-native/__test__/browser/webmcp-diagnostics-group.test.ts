import { IMarkerService } from '@opensumi/ide-markers';

import { createDiagnosticsGroup } from '../../src/browser/acp/webmcp-groups/diagnostics.webmcp-group';

describe('WebMCP diagnostics group', () => {
  function createContainer(markerService: any) {
    return {
      get: (token: any) => {
        if (token === IMarkerService) {
          return markerService;
        }
        throw new Error('service not available');
      },
    } as any;
  }

  function createMarkerService() {
    const circularStats: any = {
      errors: 1,
      warnings: 2,
      infos: 3,
      unknowns: 4,
      _manager: {},
    };
    circularStats._manager.stats = circularStats;

    return {
      getManager: () => ({
        getMarkers: () => [],
        getStats: () => circularStats,
      }),
    };
  }

  it('returns plain bounded stats for diagnostics_get_stats', async () => {
    const group = createDiagnosticsGroup(createContainer(createMarkerService()));
    const tool = group.tools.find((item) => item.name === 'diagnostics_get_stats')!;

    const result = await tool.execute({});

    expect(result).toEqual({
      success: true,
      result: {
        errors: 1,
        warnings: 2,
        infos: 3,
        unknowns: 4,
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('returns plain bounded stats from diagnostics_list', async () => {
    const group = createDiagnosticsGroup(createContainer(createMarkerService()));
    const tool = group.tools.find((item) => item.name === 'diagnostics_list')!;

    const result = await tool.execute({});

    expect(result).toEqual({
      success: true,
      result: {
        diagnostics: [],
        stats: {
          errors: 1,
          warnings: 2,
          infos: 3,
          unknowns: 4,
        },
        total: 0,
        truncated: false,
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
