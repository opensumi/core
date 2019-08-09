
import { Injectable } from '@ali/common-di';
import { IDisposable } from '@ali/ide-core-common';

@Injectable()
export abstract class IToolBarViewService {

  abstract registerToolBarElement(element: IToolBarAction | IToolBarComponent): IDisposable;

}

export interface IToolBarElementHandle extends IDisposable {

  setVisible(visible: boolean);

}

export interface IToolBarElement {

  position: ToolBarPosition;

  type: 'component' | 'action';

}

export interface IToolBarAction extends IToolBarElement {

  type: 'action';

  iconClass: string;

  title: string;

  click: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => any;

}

export interface IToolBarComponent extends IToolBarElement {

  type: 'component';

  component: React.FunctionComponent | React.ComponentClass;

}

export enum ToolBarPosition {
  /**
   * 左边
   */
  LEFT = 1,
  /**
   * 中间
   */
  CENTER = 2,
  /**
   * 右边
   */
  RIGHT = 3,
}

export const ToolBarContribution = Symbol('BrowserEditorContribution');

export interface ToolBarContribution {

  registerToolBarElement(registry: IToolBarViewService): void;

}
