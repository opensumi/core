import React from 'react';

import { useInjectable, Disposable, CancellationTokenSource, URI } from '@opensumi/ide-core-browser';

import { IMarkdownService } from '../common';

export const Markdown = ({
  content,
  onLoaded,
  onLinkClick,
}: {
  content: string;
  onLoaded?: () => void;
  onLinkClick?: (uri: URI) => void;
}) => {
  let container: HTMLElement | null = null;
  const markdownService: IMarkdownService = useInjectable(IMarkdownService);

  React.useEffect(() => {
    if (container) {
      const disposer = new Disposable();
      const cancellation = new CancellationTokenSource();
      disposer.addDispose({
        dispose: () => {
          cancellation.cancel();
        },
      });
      markdownService
        .previewMarkdownInContainer(content, container!, cancellation.token, undefined, onLinkClick)
        .then((r) => {
          disposer.addDispose(r);
          if (onLoaded) {
            onLoaded();
          }
        });

      return () => {
        disposer.dispose();
      };
    }
  }, [content]);

  return (
    <div
      ref={(el) => {
        container = el;
      }}
      style={{ height: '100%' }}
    ></div>
  );
};
