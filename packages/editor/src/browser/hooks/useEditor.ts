import { useEffect, useState } from 'react';

import { DisposableStore, URI, useInjectable } from '@opensumi/ide-core-browser';

import { IEditorDocumentModelService } from '../doc-model/types';
import { IEditorDocumentModel } from '../types';

export function useEditorDocumentModel(uri: URI) {
  const documentService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const [instance, setInstance] = useState<IEditorDocumentModel | null>(null);

  useEffect(() => {
    const toDispose = new DisposableStore();
    const run = () => {
      const ref = documentService.getModelReference(uri);
      if (ref) {
        setInstance(ref.instance);
        ref.dispose();
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

  return instance;
}
