import { removeObjectFromArray } from '@ali/ide-core-common/lib/functional';
import { observable } from 'mobx';
import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { getDebugLogger } from '@ali/ide-core-common';

import { IToolBarViewService, ToolBarPosition, IToolBarElementHandle, IToolBarAction, IToolBarComponent } from './types';

const mappedIndex = {
  [ToolBarPosition.LEFT]: 0,
  [ToolBarPosition.RIGHT]: 1,
  [ToolBarPosition.CENTER]: 2,
};

@Injectable()
export class ToolBarViewService implements IToolBarViewService {
  private elements = observable.array([
    observable.array<ToolBarElementHandle>([]),
    observable.array<ToolBarElementHandle>([]),
    observable.array<ToolBarElementHandle>([]),
  ]);

  registerToolBarElement(element: IToolBarAction | IToolBarComponent) {
    const handle = new ToolBarElementHandle(element);
    const index = mappedIndex[element.position];
    if (index === undefined) {
      getDebugLogger('Toolbar').warn('registerToolBarElement with invalid position:', element.position);
      return;
    }

    this.elements[index].push(handle);
    // sort elements
    this.elements[index] = this.elements[index].sort((a, b) => (a.element.order || 0) - (b.element.order || 0));
    handle.addDispose({
      dispose: () => {
        removeObjectFromArray(this.elements[index], handle);
      },
    });
    return handle;
  }

  getVisibleElements(position: ToolBarPosition): (IToolBarComponent | IToolBarAction)[] {
    const index = mappedIndex[position];
    if (index === undefined) {
      getDebugLogger('Toolbar').warn('getVisibleElements with invalid position:', position);
      return [];
    }
    return this.elements[index]
      .filter((handle) => handle.visible)
      .map((handle) => handle.element);
  }
}

export class ToolBarElementHandle extends Disposable implements IToolBarElementHandle {

  @observable
  public visible: boolean = true;

  constructor(public readonly element: IToolBarAction | IToolBarComponent) {
    super();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }
}
