import { EditorModule } from '../../src/node';

describe('template test', () => {
  it('EditorModule', () => {
    const cls = new EditorModule();
    expect(cls.providers).toEqual([]);
  });
});
