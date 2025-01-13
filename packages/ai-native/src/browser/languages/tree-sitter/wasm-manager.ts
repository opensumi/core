import Parser from 'web-tree-sitter';

import { Autowired, Injectable } from '@opensumi/di';
import { EKnownResources, RendererRuntime } from '@opensumi/ide-core-browser/lib/application/runtime/types';
import { Deferred } from '@opensumi/ide-utils';

/**
 * Managing and caching the wasm module
 */
@Injectable()
export class WasmModuleManager {
  private resolvedResourceUriDeferred = new Deferred<string>();

  private cachedRuntime: Map<string, Deferred<ArrayBuffer>> = new Map();

  @Autowired(RendererRuntime)
  rendererRuntime: RendererRuntime;

  private async resolveResourceUri() {
    const uri = await this.rendererRuntime.provideResourceUri(EKnownResources.TreeSitterWasmDirectory);
    this.resolvedResourceUriDeferred.resolve(uri);
  }

  constructor() {
    this.resolveResourceUri();
  }

  private parserInitialized = false;

  async initParser() {
    const baseUrl = await this.resolvedResourceUriDeferred.promise;
    let wasmPath;
    if (baseUrl.endsWith('/')) {
      wasmPath = `${baseUrl}tree-sitter.wasm`;
    } else {
      wasmPath = `${baseUrl}/tree-sitter.wasm`;
    }
    if (!this.parserInitialized) {
      await Parser.init({
        locateFile: () => wasmPath,
      });
      this.parserInitialized = true;
    }

    return new Parser();
  }

  async loadLanguage(language: string): Promise<ArrayBuffer> {
    if (!this.cachedRuntime.has(language)) {
      const deferred = new Deferred<ArrayBuffer>();
      this.cachedRuntime.set(language, deferred);
      const baseUrl = await this.resolvedResourceUriDeferred.promise;
      let wasmUrl;
      if (baseUrl.endsWith('/')) {
        wasmUrl = `${baseUrl}tree-sitter-${language}.wasm`;
      } else {
        wasmUrl = `${baseUrl}/tree-sitter-${language}.wasm`;
      }
      fetch(wasmUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          deferred.resolve(buffer);
        });
    }

    return this.cachedRuntime.get(language)!.promise;
  }
}
