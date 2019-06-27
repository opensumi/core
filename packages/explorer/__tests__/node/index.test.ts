import { ExplorerModule } from '../../src/node';

describe('template test', () => {
  it('ExplorerModule', () => {
    const cls = new ExplorerModule();
    expect(cls.providers).toEqual([]);
  });
});
