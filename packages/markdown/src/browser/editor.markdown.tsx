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
    const disposer = new Disposable();
    const cancellation = new CancellationTokenSource();
    disposer.addDispose({
      dispose: () => {
        cancellation.cancel();
      },
    });
    documentService.resolveModel(resource.uri).then((document) => {
      if (cancellation.token.isCancellationRequested) {
        return;
      }
      const onUpdate = new Emitter<string>();
      disposer.addDispose(onUpdate);
      disposer.addDispose(document.onContentChanged(() => {
        onUpdate.fire(document.getText());
      }));
      markdownService.previewMarkdownInContainer(document.getText(), container!, onUpdate.event, cancellation.token).then((r) => {
        disposer.addDispose(r);
      });
    });

    return disposer.dispose.bind(disposer);
  });

  return <div ref={(el) => {container = el; }} style={{height: '100%'}}></div>;

};
