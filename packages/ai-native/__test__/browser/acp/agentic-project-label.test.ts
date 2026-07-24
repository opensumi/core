import {
  getAgenticProjectDisplayLabel,
  getAgenticProjectDisplayLabels,
} from '../../../src/browser/acp/components/agentic-project-label';

import type { AgenticProjectRecord } from '../../../src/browser/acp/agentic-task-registry.service';

function project(
  id: string,
  workspacePath: string,
  overrides: Partial<AgenticProjectRecord> = {},
): AgenticProjectRecord {
  return {
    id,
    workspaceUri: `file://${workspacePath}`,
    workspacePath,
    joinedAt: 1,
    availability: 'available',
    ...overrides,
  };
}

describe('agentic project display labels', () => {
  it('uses the normalized final cwd segment for an unnamed Project', () => {
    const labels = getAgenticProjectDisplayLabels([project('workspace', '/ossfs/w/')]);

    expect(labels.get('workspace')).toBe('w');
  });

  it('uses the root marker for an unnamed filesystem root', () => {
    const labels = getAgenticProjectDisplayLabels([project('root', '/')]);

    expect(labels.get('root')).toBe('/');
  });

  it('adds the minimum parent suffix only to colliding unnamed Projects', () => {
    const labels = getAgenticProjectDisplayLabels([
      project('first', '/ossfs/a/w'),
      project('second', '/work/b/w'),
      project('unique', '/workspace/core'),
    ]);

    expect(labels).toEqual(
      new Map([
        ['first', 'a/w'],
        ['second', 'b/w'],
        ['unique', 'core'],
      ]),
    );
  });

  it('does not let a custom or unavailable Project change an unnamed label', () => {
    const custom = project('custom', '/other/w', { label: 'w' });
    const unnamed = project('unnamed', '/ossfs/w');
    const unavailable = project('unavailable', '/work/w', { availability: 'unavailable' });
    const labels = getAgenticProjectDisplayLabels([custom, unnamed, unavailable]);

    expect(getAgenticProjectDisplayLabel(custom, labels)).toBe('w');
    expect(getAgenticProjectDisplayLabel(unnamed, labels)).toBe('w');
  });
});
