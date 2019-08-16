import { observable } from 'mobx';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ViewContainerUiState {
  @observable width: number = 0;
  @observable height: number = 0;

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
