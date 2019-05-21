import { URI, Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { IFileTreeItem } from '../common';
import * as deepmerge from 'deepmerge';

@Injectable({ mutiple: true })
export default class LabelStore extends Disposable {
  @observable.ref
  files: IFileTreeItem[];

  init(files: IFileTreeItem[]) {
    if (!this.files) {
      this.files = files;
    } else {
      this.files = this.merge(this.files, files);
    }
  }

  merge(oldValue: IFileTreeItem[], newVlaue: IFileTreeItem[]): IFileTreeItem[] {
    const mergeOptions = {

    };
    return deepmerge(oldValue, newVlaue, mergeOptions);
  }
}
