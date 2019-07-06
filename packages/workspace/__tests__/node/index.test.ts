import { WorkspaceModule } from '../../src/node';

describe('template test', () => {
  it('WorkspaceModule', () => {
    const cls = new WorkspaceModule();
    expect(cls.providers).toEqual([]);
  });
});
