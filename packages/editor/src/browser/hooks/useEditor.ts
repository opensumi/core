import { useEffect, useState } from 'react';

import { DisposableStore, URI, useInjectable } from '@opensumi/ide-core-browser';

import { IEditorDocumentModelService } from '../doc-model/types';
import { IEditorDocumentModelRef } from '../types';

export function useEditorDocumentModelRef(uri: URI) {
  const documentService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const [ref, setRef] = useState<IEditorDocumentModelRef | null>(null);

  useEffect(() => {
    const toDispose = new DisposableStore();
    const run = () => {
      const ref = documentService.getModelReference(uri);
      if (ref) {
        setRef(ref);
        toDispose.add({
          dispose() {
            ref.dispose();
          },
        });
      }
    };

    toDispose.add(
      documentService.onDocumentModelCreated(uri.toString(), () => {
        run();
      }),
    );

    run();
    return () => {
      toDispose.dispose();
    };
  }, [uri]);

  return ref;
}
