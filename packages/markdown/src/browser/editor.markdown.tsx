import * as React from 'react';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, Disposable, CancellationTokenSource, Emitter } from '@ali/ide-core-browser';
import { IMarkdownService } from '../common';
import { IDocumentModelManager } from '@ali/ide-doc-model/lib/common';

export const MarkdownEditorComponent: ReactEditorComponent<any> = ({resource}) => {
  let container: HTMLElement | null = null;
  const markdownService: IMarkdownService = useInjectable(IMarkdownService);
  const documentService: IDocumentModelManager = useInjectable(IDocumentModelManager);

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
        disposer.addDispose(documentRef.instance.onContentChanged(() => {
          onUpdate.fire(documentRef.instance.getText());
        }));
        markdownService.previewMarkdownInContainer(documentRef.instance.getText(), container!, onUpdate.event, cancellation.token).then((r) => {
          disposer.addDispose(r);
        });
        disposer.addDispose(documentRef);
      });

      return () => {
        disposer.dispose();
      };
    }
  });

  return <div ref={(el) => {container = el; }} style={{height: '100%'}}></div>;

};
