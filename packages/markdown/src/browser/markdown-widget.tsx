import * as React from 'react';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, Disposable, CancellationTokenSource, Emitter } from '@ali/ide-core-browser';
import { IMarkdownService } from '../common';
import { IDocumentModelManager } from '@ali/ide-doc-model/lib/common';

export const Markdown = ({content, onLoaded}: {content: string, onLoaded?: () => void}) => {
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
      markdownService.previewMarkdownInContainer(content, container!, cancellation.token).then((r) => {
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

  return <div ref={(el) => {container = el; }} style={{height: '100%'}}></div>;

};
