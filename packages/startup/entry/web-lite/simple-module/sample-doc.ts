import { IResourceProvider } from '@ali/ide-editor/lib/browser';
import { URI } from '@ali/ide-core-common';

// TODO: use `FileSystemResourceProvider` instead when ready
export class SampleResourceProvider implements IResourceProvider {
  readonly scheme = 'file';
  provideResource(uri: URI) {
    return {
      name: uri.codeUri.path,
      icon: '', // 依赖 labelService
      uri,
      metadata: null,
    };
  }
}

export class AntcodeResourceProvider implements IResourceProvider {
  readonly scheme = 'antcode';
  provideResource(uri: URI) {
    return {
      name: uri.codeUri.path,
      icon: '', // 依赖 labelService
      uri,
      metadata: null,
    };
  }
}
