import React from 'react';

import { IMarkedOptions } from '@opensumi/ide-components/lib/utils';
import { CancellationTokenSource, Disposable, URI, useInjectable } from '@opensumi/ide-core-browser';

import { IMarkdownService } from '../common';

export const Markdown = ({
  content,
  options,
  onLoaded,
  onLinkClick,
}: {
  content: string;
  options?: IMarkedOptions;
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
        .previewMarkdownInContainer(content, container!, cancellation.token, options, undefined, onLinkClick)
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
