import { URI, Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { LabelProvider } from './label-provider';

@Injectable({ mutiple: true })
export default class LabelStore extends Disposable {
  @observable.ref
  icon: string;

  @Autowired()
  labelProvider: LabelProvider;

  async parse(uri: URI) {
    if (!this.icon) {
      const icon = await this.labelProvider.getIcon(uri);
      this.icon = icon;
    }
  }
}
