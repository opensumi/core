import { TemplateUpperNameModule } from '../../src/browser';

describe('template test', () => {
  it('TemplateUpperNameModule', () => {
    const cls = new TemplateUpperNameModule();
    expect(cls.providers).toEqual([]);
  });
});
