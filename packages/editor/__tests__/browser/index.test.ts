import { EditorModule } from '../../src/browser';

describe('template test', () => {
  it('EditorModule', () => {
    const cls = new EditorModule();
    expect(cls.providers).toEqual([]);
  });
});
