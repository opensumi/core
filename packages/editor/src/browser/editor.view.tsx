import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.less';

export const EditorView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorServiceImpl) as WorkbenchEditorServiceImpl;

  return (
    <div className={ styles.kt_workbench_editor } ref={(ele) => ref.current = ele}>
      {
        instance.editorGroups.map(group => {
          return <EditorGroupView group={group} />
        })
      }
    </div>
  );
});

export const EditorGroupView = observer(({ group }: { group: EditorGroup }) => {
  const ref = React.useRef<HTMLElement | null>();

  React.useEffect(() => {
    if (ref.current) {
      group.createEditor(ref.current);
    }
  }, [ref]);
  return (
    <div className='kt-code-editor' ref={(ele) => ref.current = ele}></div>
  );
});
