import { Injectable } from '@ali/common-di';
import {
  URI,
  WithEventBus,
  MaybePromise,
  localize,
} from '@ali/ide-core-browser';
import { IResourceProvider, IResource } from '@ali/ide-editor';
import { EXTENSION_SCHEME } from '../common';

@Injectable()
export class ExtensionResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = EXTENSION_SCHEME;

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    const { name } = uri.getParsedQuery();
    return {
      name: `${localize('extension', 'Extension')}: ${name}`,
      icon: '',
      uri,
    };
  }
}
