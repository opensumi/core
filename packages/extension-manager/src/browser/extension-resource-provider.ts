import { Injectable, Autowired } from '@ali/common-di';
import {
  URI,
  WithEventBus,
  MaybePromise,
  localize,
} from '@ali/ide-core-browser';
import { IResourceProvider, IResource } from '@ali/ide-editor';
import { EXTENSION_SCHEME } from '../common';
import { IIconService, IconType } from '@ali/ide-theme';
import styles from './extension-manager.common.module.less';

@Injectable()
export class ExtensionResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = EXTENSION_SCHEME;

  @Autowired(IIconService)
  iconService: IIconService;

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    const { name, icon } = uri.getParsedQuery();
    const iconClass = this.iconService.fromIcon('', icon, IconType.Background);
    return {
      name: `${localize('marketplace.extension.container')}: ${name}`,
      icon: `${iconClass} ${styles.tab_icon}`,
      uri,
    };
  }
}
