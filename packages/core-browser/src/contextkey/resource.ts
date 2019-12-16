import { IContextKeyService, IContextKey } from '../context-key';
import { URI } from '@ali/ide-core-common';
import { getLanguageIdFromMonaco } from '../services/label-service';

export type ILanguageResolver = (uri: URI)  => string | null;

export class ResourceContextKey {

  private resourceScheme: IContextKey<string>;
  private resourceFilename: IContextKey<string>;
  private resourceExtname: IContextKey<string>;
  private resourceLangId: IContextKey<string>;
  private resourceKey: IContextKey<string>;
  private isFileSystemResource: IContextKey<boolean>;

  constructor(private contextKeyService: IContextKeyService, private languageResolver: ILanguageResolver = getLanguageIdFromMonaco) {
    this.resourceScheme = this.contextKeyService.createKey<string>('resourceScheme', '');
    this.resourceFilename = this.contextKeyService.createKey<string>('resourceFilename', '');
    this.resourceExtname = this.contextKeyService.createKey<string>('resourceExtname', '');
    this.resourceLangId = this.contextKeyService.createKey<string>('resourceLangId', '');
    this.resourceKey = this.contextKeyService.createKey<string>('resource', '');
    this.isFileSystemResource = this.contextKeyService.createKey<boolean>('isFileSystemResource', false);
  }

  set(uri: URI) {
    if (!uri) {
      this.reset();
    }
    this.resourceScheme.set(uri.scheme);
    this.resourceFilename.set(uri.path.name);
    this.resourceExtname.set(uri.path.ext);
    this.resourceLangId.set(this.languageResolver(uri)!); // TODO
    this.resourceKey.set(uri.toString());
    this.isFileSystemResource.set(uri.scheme === 'file'); // TOOD FileSystemClient.canHandle
  }

  reset() {
    this.resourceScheme.set('');
    this.resourceFilename.set('');
    this.resourceExtname.set('');
    this.resourceLangId.set(''); // TODO
    this.resourceKey.set('');
    this.isFileSystemResource.set(false); // TOOD FileSystemClient.canHandle
  }

}
