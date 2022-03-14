import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { StaticResourceModule, StaticResourceService } from '../../src/browser/index';

describe('static-resource test', () => {
  const injector = createBrowserInjector([StaticResourceModule]);

  const staticResourceService = injector.get<StaticResourceService>(StaticResourceService);

  it('add a test-query static resource provider', () => {
    // 给 uri 添加 name 的 query
    staticResourceService.registerStaticResourceProvider({
      scheme: 'test',
      resolveStaticResource: (uri: URI) =>
        uri.withQuery(
          decodeURIComponent(
            URI.stringifyQuery({
              name: 'test',
            }),
          ),
        ),
    });

    const uri = staticResourceService.resolveStaticResource(
      URI.from({
        scheme: 'test',
        path: 'path',
      }),
    );

    expect(uri.query).toEqual('name=test');
  });
});
