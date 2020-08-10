import { Injectable } from '@ali/common-di';
import { renderInfoItem, renderAddItem } from './component/tab.item';

@Injectable()
export class TerminalRenderProvider {
  /**
   * @override terminal tab item renderer
   */
  get infoItemRender() {
    return renderInfoItem;
  }

  /**
   * @override terminal add item renderer
   */
  get addItemRender() {
    return renderAddItem;
  }
}
