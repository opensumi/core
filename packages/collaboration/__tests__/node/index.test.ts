import { CollaborationServerModule } from '../../src/node';

describe('template test', () => {
  it('TemplateUpperNameModule', () => {
    const cls = new CollaborationServerModule();
    expect(cls.providers).toEqual([]);
  });
});
