import { Injectable } from '@ali/common-di';
import { IEditorActionRegistry, IEditorActionItem } from '../types';
import { IDisposable, URI } from '@ali/ide-core-browser';
import { IResource } from '../../common';
import { observable } from 'mobx';

@Injectable()
export class EditorActionRegistryImpl implements IEditorActionRegistry {

  @observable.shallow private items: IEditorActionItem[] = [];

  registerEditorAction(actionItem: IEditorActionItem): IDisposable {
    this.items.push(actionItem);
    return {
      dispose: () => {
        const index = this.items.indexOf(actionItem);
        if (index !== -1) {
          this.items.splice(index, 1);
        }
      },
    };
  }

  getActions(resource: IResource): IEditorActionItem[] {
    return this.items.filter((item) => {
      if (!item.isVisible) {
        return item;
      } else {
        try {
          return item.isVisible(resource);
        } catch (e) {
          return false;
        }
      }
    });
  }
}
