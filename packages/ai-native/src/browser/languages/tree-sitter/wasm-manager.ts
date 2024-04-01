import Parser from 'web-tree-sitter';

import { Autowired, Injectable } from '@opensumi/di';
import { EKnownResources, IRendererRuntime } from '@opensumi/ide-core-browser/lib/application/runtime/types';
import { Deferred } from '@opensumi/ide-utils';

/**
 * Managing and caching the wasm module
 */
@Injectable()
export class WasmModuleManager {
  private resolvedResourceUriDeferred = new Deferred<string>();

  private cachedRuntime: Map<string, Deferred<ArrayBuffer>> = new Map();

  @Autowired(IRendererRuntime)
  rendererRuntime: IRendererRuntime;

  private async resolveResourceUri() {
    const uri = await this.rendererRuntime.provideResourceUri(EKnownResources.TreeSitterWasmDirectory);
    this.resolvedResourceUriDeferred.resolve(uri);
  }

  constructor() {
    this.resolveResourceUri();
  }

  async initParser() {
    const baseUrl = await this.resolvedResourceUriDeferred.promise;
    const wasmPath = `${baseUrl}/tree-sitter.wasm`;
    return Parser.init({
      locateFile: () => wasmPath,
    }).then(async () => new Parser());
  }

  async loadLanguage(language: string): Promise<ArrayBuffer> {
    if (!this.cachedRuntime.has(language)) {
      const deferred = new Deferred<ArrayBuffer>();
      this.cachedRuntime.set(language, deferred);
      const baseUrl = await this.resolvedResourceUriDeferred.promise;
      const wasmUrl = `${baseUrl}/tree-sitter-${language}.wasm`;
      fetch(wasmUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          deferred.resolve(buffer);
        });
    }

    return this.cachedRuntime.get(language)!.promise;
  }
}
