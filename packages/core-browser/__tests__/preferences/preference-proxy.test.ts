import {
  createPreferenceProxy,
  DefaultPreferenceProvider,
  ILogger,
  PreferenceChangeEvent,
  PreferenceConfigurations,
  PreferenceContribution,
  PreferenceProvider,
  PreferenceProviderProvider,
  PreferenceProxy,
  PreferenceProxyOptions,
  PreferenceSchema,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceService,
  PreferenceServiceImpl,
} from '@opensumi/ide-core-browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockLogger } from '../../__mocks__/logger';
import { injectMockPreferences, MockPreferenceProvider } from '../../__mocks__/preference';

describe('Preference Proxy', () => {
  let injector: MockInjector;
  let preferenceService: PreferenceService;
  let preferenceSchema: PreferenceSchemaProvider;

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injectMockPreferences(injector);

    injector.overrideProviders(
      {
        token: PreferenceConfigurations,
        useValue: {
          getSectionNames: () => [],
          isSectionName: () => false,
        },
      },
      {
        token: PreferenceContribution,
        useValue: {
          getContributions: () => [],
        },
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: PreferenceProviderProvider,
        useFactory: () => (scope: PreferenceScope) => {
          if (scope === PreferenceScope.Default) {
            return injector.get(DefaultPreferenceProvider);
          }
          return injector.get<MockPreferenceProvider>(PreferenceProvider, { tag: scope });
        },
      },
      {
        token: PreferenceService,
        useClass: PreferenceServiceImpl,
      },
      {
        token: PreferenceSchemaProvider,
        useClass: PreferenceSchemaProvider,
      },
    );

    preferenceSchema = injector.get(PreferenceSchemaProvider);

    preferenceService = injector.get(PreferenceService);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  function getProxy(
    schema?: PreferenceSchema,
    options?: PreferenceProxyOptions,
  ): PreferenceProxy<{ [key: string]: any }> {
    const s: PreferenceSchema = schema || {
      properties: {
        'my.pref': {
          type: 'string',
          defaultValue: 'foo',
        },
      },
    };
    preferenceSchema.setSchema(s);
    return createPreferenceProxy(preferenceService, s, options);
  }

  it('by default, it should get provide access in flat style but not deep', () => {
    const proxy = getProxy();
    expect(proxy['my.pref']).toBe('foo');
    expect(proxy.my).toBe(undefined);
    expect(Object.keys(proxy).join()).toBe(['my.pref'].join());
  });

  it('it should get provide access in deep style but not flat', () => {
    const proxy = getProxy(undefined, { style: 'deep' });
    expect(proxy['my.pref']).toBe(undefined);
    expect(proxy.my.pref).toBe('foo');
    expect(Object.keys(proxy).join()).toBe(['my'].join());
  });

  it('it should get provide access in to both styles', () => {
    const proxy = getProxy(undefined, { style: 'both' });
    expect(proxy['my.pref']).toBe('foo');
    expect(proxy.my.pref).toBe('foo');
    expect(Object.keys(proxy).join()).toBe(['my', 'my.pref'].join());
  });

  it('it should forward change events', async (done) => {
    const proxy = getProxy(undefined, { style: 'both' });
    let theChange: PreferenceChangeEvent<{ [key: string]: any }>;
    proxy.onPreferenceChanged((change) => {
      expect(theChange).toBe(undefined);
      theChange = change;
      expect(theChange!.newValue).toBe('bar');
      expect(theChange!.oldValue).toBe(undefined);
      expect(theChange!.preferenceName).toBe('my.pref');
    });
    let theSecondChange: PreferenceChangeEvent<{ [key: string]: any }>;
    (proxy.my as PreferenceProxy<{ [key: string]: any }>).onPreferenceChanged((change) => {
      expect(theSecondChange).toBe(undefined);
      theSecondChange = change;
      expect(theSecondChange!.newValue).toBe('bar');
      expect(theSecondChange!.oldValue).toBe(undefined);
      expect(theSecondChange!.preferenceName).toBe('my.pref');
      done();
    });
    await preferenceService.set('my.pref', 'bar', PreferenceScope.User);
  });

  it('toJSON with deep', () => {
    const proxy = getProxy(
      {
        properties: {
          'foo.baz': {
            type: 'number',
            default: 4,
          },
          'foo.bar.x': {
            type: 'boolean',
            default: true,
          },
          'foo.bar.y': {
            type: 'boolean',
            default: false,
          },
          a: {
            type: 'string',
            default: 'a',
          },
        },
      },
      { style: 'deep' },
    );
    expect(JSON.stringify(proxy, undefined, 2)).toBe(
      JSON.stringify(
        {
          foo: {
            baz: 4,
            bar: {
              x: true,
              y: false,
            },
          },
          a: 'a',
        },
        undefined,
        2,
      ),
    );
  });

  it('get nested default', () => {
    const proxy = getProxy(
      {
        properties: {
          foo: {
            anyOf: [
              {
                enum: [false],
              },
              {
                properties: {
                  bar: {
                    anyOf: [
                      {
                        enum: [false],
                      },
                      {
                        properties: {
                          x: {
                            type: 'boolean',
                          },
                          y: {
                            type: 'boolean',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            default: {
              bar: {
                x: true,
                y: false,
              },
            },
          },
        },
      },
      { style: 'both' },
    );
    expect(proxy['foo']).toEqual({
      bar: {
        x: true,
        y: false,
      },
    });
    expect(proxy['foo.bar']).toEqual({
      x: true,
      y: false,
    });
    expect(proxy['foo.bar.x']).toBeTruthy();
    expect(proxy['foo.bar.y']).toBeFalsy();
  });
});
