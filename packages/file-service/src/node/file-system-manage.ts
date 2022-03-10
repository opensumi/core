import { IDisposable } from '@opensumi/ide-core-common';

import { FileSystemProvider, IDiskFileProvider } from '../common/';

export class FileSystemManage {
  readonly providers = new Map<string, FileSystemProvider | IDiskFileProvider>();

  add(scheme: string, provider: FileSystemProvider): IDisposable {
    if (this.providers.has(scheme)) {
      throw new Error(`A provider for the scheme ${scheme} is already registered.`);
    }
    this.providers.set(scheme, provider);
    return {
      dispose: () => {
        this.providers.delete(scheme);
      },
    };
  }

  delete(scheme: string) {
    this.providers.delete(scheme);
  }

  get(scheme: string) {
    return this.providers.get(scheme);
  }
}
