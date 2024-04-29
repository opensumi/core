import React from 'react';

export interface IEditorContext {
  minimapWidth: number;
}

export const defaultEditorContext: IEditorContext = {
  minimapWidth: 108,
};

export const EditorContext = React.createContext<IEditorContext>(defaultEditorContext);
