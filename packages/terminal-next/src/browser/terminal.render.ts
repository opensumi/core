import { Injectable } from '@opensumi/di';
import { renderInfoItem, renderAddItem } from './component/tab.item';
import { ITerminalRenderProvider } from '../common';

@Injectable()
export class TerminalRenderProvider implements ITerminalRenderProvider {
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
