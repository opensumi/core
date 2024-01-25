import { Injectable } from '@opensumi/di';
import { IAiInlineResultIconItemsProps } from '@opensumi/ide-core-browser/lib/components/ai-native/inline-chat/result';

import { ResolveResultWidget } from './resolve-result-widget';

@Injectable({ multiple: true })
export class StopWidget extends ResolveResultWidget {
  override isRenderThumbs(): boolean {
    return false;
  }

  override iconItems(): IAiInlineResultIconItemsProps[] {
    return [
      {
        icon: 'circle-pause',
        text: '停止',
        onClick: () => {
          this.codeEditor.cancelRequestToken();
          this.codeEditor.hideStopWidget(this.lineRange.id);
        },
      },
    ];
  }

  override id(): string {
    return `${super.id()}_stop_${this.uid}`;
  }
}
