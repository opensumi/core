import React from 'react';

import { URI, useInjectable } from '@opensumi/ide-core-browser';

import { EditorCollectionService, ICodeEditor } from '../../common';
import { IEditorDocumentModelService, IEditorDocumentModelRef } from '../doc-model/types';

export interface ICodeEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  uri?: URI;

  options?: any;

  editorRef?: (editor: ICodeEditor | undefined) => void;
}

export const CodeEditor = (props: ICodeEditorProps) => {
  const container = React.useRef<HTMLDivElement>();
  const editorCollectionService: EditorCollectionService = useInjectable(EditorCollectionService);
  const documentService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const [editor, setEditor] = React.useState<ICodeEditor | undefined>(undefined);
  const [documentModelRef, setDocumentModelRef] = React.useState<IEditorDocumentModelRef | undefined>(undefined);
  const [uri, setUri] = React.useState<string | undefined>(undefined);
  const [fetchingUri, setFetchingUri] = React.useState<string | undefined>(undefined);
  let canceled = false;

  React.useEffect(() => {
    if (container.current) {
      if (editor) {
        editor.dispose();
      }
      const e = editorCollectionService.createCodeEditor(container.current, {
        automaticLayout: true,
        ...props.options,
      });
      setEditor(e);
      if (documentModelRef) {
        e.open(documentModelRef);
      }
    }
    return () => {
      canceled = true;
      if (editor) {
        editor.dispose();
      }
      if (documentModelRef) {
        documentModelRef.dispose();
      }
    };
  }, [container.current]);

  if (props && editor && props.editorRef) {
    props.editorRef(editor);
  }

  if (uri) {
    if (fetchingUri !== uri) {
      setFetchingUri(uri);
      documentService.createModelReference(new URI(uri), 'editor-react-component').then((ref) => {
        if (documentModelRef) {
          documentModelRef.dispose();
        }
        if (!canceled && ref.instance.uri.toString() === uri) {
          setDocumentModelRef(ref);
        } else {
          ref.dispose();
        }
      });
    }
  }

  if (documentModelRef) {
    if (editor && editor.currentDocumentModel !== documentModelRef.instance) {
      editor.open(documentModelRef);
    }
  }

  if (props.uri && props.uri.toString() !== uri) {
    setUri(props.uri.toString());
  }

  return <div ref={(el) => el && (container.current = el)} {...props}></div>;
};
