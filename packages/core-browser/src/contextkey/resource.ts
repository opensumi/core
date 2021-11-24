import { URI } from '@opensumi/ide-core-common';

import { IContextKeyService, IContextKey } from '../context-key';
import { getLanguageIdFromMonaco } from '../services/label-service';

export type ILanguageResolver = (uri: URI) => string | null;

export class ResourceContextKey {
  private resourceScheme: IContextKey<string>;
  private resourceFilename: IContextKey<string>;
  private resourceExtname: IContextKey<string>;
  private resourceLangId: IContextKey<string>;
  private resourceKey: IContextKey<string>;
  private isFileSystemResource: IContextKey<boolean>;

  constructor(private contextKeyService: IContextKeyService, private languageResolver: ILanguageResolver = getLanguageIdFromMonaco, prefix: string = 'resource') {
    if (!prefix) {
      throw new Error('resource key prefix cannot be empty!');
    }
    this.resourceScheme = this.contextKeyService.createKey<string>(prefix + 'Scheme', '');
    this.resourceFilename = this.contextKeyService.createKey<string>(prefix + 'Filename', '');
    this.resourceExtname = this.contextKeyService.createKey<string>(prefix + 'Extname', '');
    this.resourceLangId = this.contextKeyService.createKey<string>(prefix + 'LangId', '');
    this.resourceKey = this.contextKeyService.createKey<string>(prefix, '');
    this.isFileSystemResource = this.contextKeyService.createKey<boolean>('isFileSystem' + prefix.substr(0, 1).toUpperCase() + prefix.substr(1), false);
  }

  set(uri: URI) {
    if (!uri) {
      this.reset();
    }

    const resource = this.resourceKey.get();
    // 相同的 URI 则不再重新设置
    if (!uri.isEqual(new URI(resource))) {
      this.resourceScheme.set(uri.scheme);
      this.resourceFilename.set(uri.path.name + uri.path.ext);
      this.resourceExtname.set(uri.path.ext);
      this.resourceLangId.set(this.languageResolver(uri)!);
      this.resourceKey.set(uri.toString());
      this.isFileSystemResource.set(uri.scheme === 'file');
    }
  }

  reset() {
    this.resourceScheme.set('');
    this.resourceFilename.set('');
    this.resourceExtname.set('');
    this.resourceLangId.set('');
    this.resourceKey.set('');
    this.isFileSystemResource.set(false);
  }

}
