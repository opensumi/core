import path from 'path';

import { Injector } from '@opensumi/di';
import { LanguageParserService } from '@opensumi/ide-ai-native/lib/browser/languages/service';
import { AppConfig, BrowserModule } from '@opensumi/ide-core-browser';
import { ESupportRuntime } from '@opensumi/ide-core-browser/lib/application/runtime';
import { IRendererRuntime } from '@opensumi/ide-core-browser/lib/application/runtime/types';
import { Uri } from '@opensumi/ide-core-common';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

class MockRendererRuntime extends IRendererRuntime {
  runtimeName = 'web' as ESupportRuntime;
  mergeAppConfig(meta: AppConfig): AppConfig {
    throw new Error('Method not implemented.');
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    throw new Error('Method not implemented.');
  }
  registerRuntimeModuleProviders(injector: Injector, module: BrowserModule<any>): void {
    throw new Error('Method not implemented.');
  }
  async provideResourceUri() {
    const result = path.dirname(require.resolve('@opensumi/tree-sitter-wasm/package.json'));
    return Uri.file(result).toString();
  }
}

describe.skip('tree sitter', () => {
  let injector: MockInjector;
  beforeAll(() => {
    injector = new MockInjector([
      {
        token: LanguageParserService,
        useClass: LanguageParserService,
      },
    ]);
    injector.mockService(IRendererRuntime, new MockRendererRuntime());
  });

  it('parser', async () => {
    const service = injector.get(LanguageParserService) as LanguageParserService;
    const parser = service.createParser('javascript');
    expect(parser).toBeDefined();

    await parser!.ready();
  });
});
