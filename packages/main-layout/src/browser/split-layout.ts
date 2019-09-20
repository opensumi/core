import { SplitLayout } from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';

export class CustomSplitLayout extends SplitLayout {

  moveHandle(index: number, position: number) {
    if (this.handles[index].classList.contains('p-lock')) {
      return;
    }
    super.moveHandle(index, position);
  }
}
