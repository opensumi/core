import React from 'react';

import { useInjectable, Disposable, CancellationTokenSource, Emitter } from '@opensumi/ide-core-browser';
import { ReactEditorComponent, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';

import { IMarkdownService } from '../common';

export const MarkdownEditorComponent: ReactEditorComponent<any> = ({ resource }) => {
  let container: HTMLElement | null = null;
  const markdownService: IMarkdownService = useInjectable(IMarkdownService);
  const documentService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);

  React.useEffect(() => {
    if (container) {
      const disposer = new Disposable();
      const cancellation = new CancellationTokenSource();
      disposer.addDispose({
        dispose: () => {
          cancellation.cancel();
        },
      });
      documentService.createModelReference(resource.uri, 'markdown-preview').then((documentRef) => {
        if (cancellation.token.isCancellationRequested) {
          if (documentRef) {
            documentRef.dispose();
          }
          return;
        }
        const onUpdate = new Emitter<string>();
        disposer.addDispose(onUpdate);
        disposer.addDispose(
          documentRef.instance.getMonacoModel().onDidChangeContent((e) => {
            onUpdate.fire(documentRef.instance.getText());
          }),
        );
        if (container) {
          // container可能已不存在
          markdownService
            .previewMarkdownInContainer(documentRef.instance.getText(), container!, cancellation.token, onUpdate.event)
            .then((r) => {
              disposer.addDispose(r);
            });
        }
        disposer.addDispose(documentRef);
      });

      return () => {
        disposer.dispose();
      };
    }
  });

  return (
    <div
      ref={(el) => {
        container = el;
      }}
      style={{ height: '100%' }}
    ></div>
  );
};
