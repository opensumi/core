import React from 'react';

import {
  BasicEvent,
  CancellationToken,
  IEventBus,
  useInjectable,
  CancellationTokenSource,
  Disposable,
} from '@opensumi/ide-core-browser';

import { ExtensionService } from '../../common';

export class WebviewViewShouldShowEvent extends BasicEvent<{
  title: string;
  viewType: string;
  container: HTMLElement;
  cancellationToken: CancellationToken;
  disposer: Disposable;
}> {}

export const ExtensionWebviewView: React.FC<{ viewId: string }> = ({ viewId }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const eventBus: IEventBus = useInjectable(IEventBus);
  const extensionService: ExtensionService = useInjectable(ExtensionService);

  React.useEffect(() => {
    const cancellationTokenSource = new CancellationTokenSource();
    const disposer = new Disposable({ dispose: () => cancellationTokenSource.cancel() });

    extensionService.eagerExtensionsActivated.promise.then(() => {
      if (cancellationTokenSource.token.isCancellationRequested) {
        return;
      }
      if (containerRef.current) {
        eventBus.fire(
          new WebviewViewShouldShowEvent({
            viewType: viewId,
            container: containerRef.current!,
            title: '', // mainLayoutService.getTabbarHandler(viewId).titl
            cancellationToken: cancellationTokenSource.token,
            disposer,
          }),
        );
      }
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  return (
    <div
      style={{ height: '100%', width: '100%', position: 'relative' }}
      className='webview-view-component'
      ref={containerRef}
    ></div>
  );
};
