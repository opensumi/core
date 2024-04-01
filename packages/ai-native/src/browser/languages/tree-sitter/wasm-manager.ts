import Parser from 'web-tree-sitter';

import { Deferred } from '@opensumi/ide-utils';

export interface WasmModuleManagerOptions {
  baseUrl: string;
}

/**
 * Managing and caching the wasm module
 */
export class WasmModuleManager {
  private cachedRuntime: Map<string, Deferred<ArrayBuffer>> = new Map();

  constructor(protected opts: WasmModuleManagerOptions) {}

  async initParser() {
    const wasmPath = `${this.opts.baseUrl}/tree-sitter.wasm`;
    return Parser.init({
      locateFile: () => wasmPath,
    }).then(async () => new Parser());
  }

  loadLanguage(language: string): Promise<ArrayBuffer> {
    if (!this.cachedRuntime.has(language)) {
      const deferred = new Deferred<ArrayBuffer>();
      this.cachedRuntime.set(language, deferred);
      const wasmUrl = `${this.opts.baseUrl}/tree-sitter-${language}.wasm`;
      fetch(wasmUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          deferred.resolve(buffer);
        });
    }

    return this.cachedRuntime.get(language)!.promise;
  }
}
