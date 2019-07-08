import * as React from 'react';

export interface OpenedEditorTreeProps {
  dataProvider: any;
}

export const OpenedEditorTree = ({
  dataProvider,
}: React.PropsWithChildren<OpenedEditorTreeProps>) => {
  return <div>OpenedEditorTree</div>;
};
