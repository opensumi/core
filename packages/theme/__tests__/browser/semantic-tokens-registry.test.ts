import { ILogger } from '@opensumi/ide-logs/lib/common';
import { SemanticTokenRegistryImpl } from '@opensumi/ide-theme/lib/browser/semantic-tokens-registry';
import { getStylingSchemeEntry, ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

describe('Semantic Tokens Registry', () => {
  let injector: MockInjector;
  let semanticTokenRegistry: SemanticTokenRegistryImpl;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ILogger,
        useValue: {
          debug: jest.fn(),
          log: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
        },
      },
      {
        token: ISemanticTokenRegistry,
        useClass: SemanticTokenRegistryImpl,
      },
    );

    semanticTokenRegistry = injector.get(ISemanticTokenRegistry);
  });

  it('registerTokenType', () => {
    semanticTokenRegistry.registerTokenType('annotation', 'Style for annotations');

    const annotationTokenType = semanticTokenRegistry['tokenTypeById']['annotation'];
    expect(annotationTokenType).toBeDefined();
    expect(annotationTokenType.id).toBe('annotation');
    expect(annotationTokenType.description).toBe('Style for annotations');
    expect(annotationTokenType.superType).toBeUndefined();
    expect(annotationTokenType.deprecationMessage).toBeUndefined();

    const tokenStylingSchema = semanticTokenRegistry['tokenStylingSchema'].properties['annotation'];
    expect(tokenStylingSchema).toBeDefined();
    expect(tokenStylingSchema).toEqual(getStylingSchemeEntry('Style for annotations', undefined));
  });

  it('registerTokenModifier', () => {
    semanticTokenRegistry.registerTokenModifier('public', 'Style for symbols with the public access modifier.');

    const publicTokenModifier = semanticTokenRegistry['tokenModifierById']['public'];
    expect(publicTokenModifier).toBeDefined();
    expect(publicTokenModifier.id).toBe('public');
    expect(publicTokenModifier.description).toBe('Style for symbols with the public access modifier.');
    expect(publicTokenModifier.num).toBe(1);

    const publicStylingSchema = semanticTokenRegistry['tokenStylingSchema'].properties['*.public'];
    expect(publicStylingSchema).toBeDefined();
    expect(publicStylingSchema).toEqual(
      getStylingSchemeEntry('Style for symbols with the public access modifier.', undefined),
    );
  });

  it('parseTokenSelector & registerTokenScope', () => {
    const parsedSelector = semanticTokenRegistry.parseTokenSelector('annotation', 'java');
    const scopes = ['storage.type.annotation.java'];
    expect(parsedSelector.match('keyword', [], 'java')).toBe(-1);
    expect(parsedSelector.match('annotation', ['public'], 'java')).toBe(110);
    expect(parsedSelector.id).toBe('annotation:java');
    semanticTokenRegistry.registerTokenStyleDefault(parsedSelector, {
      scopesToProbe: scopes.map((s) => s.split(' ')),
    });

    const tokenStyleDefault = semanticTokenRegistry['tokenStylingDefaultRules'].find(
      (r) => r.selector.id === 'annotation:java',
    );
    expect(tokenStyleDefault).toBeDefined();
    expect(tokenStyleDefault?.defaults.scopesToProbe).toBeDefined();
    expect(tokenStyleDefault?.defaults.scopesToProbe).toEqual([['storage.type.annotation.java']]);
  });
});
