import { TemplateUpperNameModule } from '../../src/node';

describe('template test', () => {
  it('TemplateUpperNameModule', () => {
    const cls = new TemplateUpperNameModule();
    expect(cls.providers).toEqual([]);
  });
});
