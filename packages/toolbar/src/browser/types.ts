
import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';

@Injectable()
export abstract class IToolBarViewService {

  abstract registerToolBarElement(element: IToolBarAction | IToolBarComponent): IToolBarElementHandle | undefined;

  abstract getVisibleElements(position: ToolBarPosition): (IToolBarComponent | IToolBarAction)[];
}

export interface IToolBarElementHandle extends IDisposable {
  visible: boolean;

  setVisible(visible: boolean);

}

export interface IToolBarElement {

  id?: string;

  position: ToolBarPosition | string;

  type: 'component' | 'action';

  /**
   * 排序因子，越小越靠前
   * @ deprecated
   */
  order?: number;

  /**
   * 排序因子，越大越靠前
   */
  weight?: number;

}

export interface IToolBarAction extends IToolBarElement {

  type: 'action';

  iconClass: string;

  title: string;

  click: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => any;

  description?: string;
}

export interface IToolBarComponent<InitialPropsType = any> extends IToolBarElement {

  type: 'component';

  component: React.ComponentType<InitialPropsType>;

  initialProps?: InitialPropsType;

  description?: string;
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
