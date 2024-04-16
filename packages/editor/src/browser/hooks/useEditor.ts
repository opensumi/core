import { useEffect, useState } from 'react';

import { IEventBus, URI, useInjectable } from '@opensumi/ide-core-browser';

import { EditorDocumentModelCreationEvent, IEditorDocumentModelService } from '../doc-model/types';
import { IEditorDocumentModelRef } from '../types';

export function useEditorDocumentModelRef(uri: URI) {
  const documentService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const [ref, setRef] = useState<IEditorDocumentModelRef | null>(null);

  useEffect(() => {
    const run = () => {
      const ref = documentService.getModelReference(uri);
      if (ref) {
        setRef(ref);
      }
    };

    const toDispose = documentService.onDocumentModelCreated(uri.toString(), () => {
      run();
    });

    run();
    return () => {
      toDispose.dispose();
      if (ref) {
        ref.dispose();
      }
    };
  }, [uri]);

  return ref;
}
