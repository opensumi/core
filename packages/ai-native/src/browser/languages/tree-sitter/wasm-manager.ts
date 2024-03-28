import { Deferred } from '@opensumi/ide-utils';

/**
 * Managing and caching the wasm module
 */
class WasmModuleManager {
  private cachedRuntime: Map<string, Deferred<ArrayBuffer>> = new Map();

  loadWasm(language: string): Promise<ArrayBuffer> {
    if (!this.cachedRuntime.has(language)) {
      const deferred = new Deferred<ArrayBuffer>();
      this.cachedRuntime.set(language, deferred);
      const wasmUrl = `/tree-sitter-${language}.wasm`;
      fetch(wasmUrl)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          deferred.resolve(buffer);
        });
    }

    return this.cachedRuntime.get(language)!.promise;
  }
}

export const wasmModuleManager = new WasmModuleManager();
