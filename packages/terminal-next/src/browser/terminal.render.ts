import { Injectable } from '@opensumi/di';

import { ITerminalRenderProvider } from '../common';

import { renderInfoItem, renderAddItem } from './component/tab.item';

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
