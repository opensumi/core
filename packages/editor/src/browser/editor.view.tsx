import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.less';
import { WorkbenchEditorService } from '../common';

export const EditorView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

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
    <div className={styles.kt_code_editor} ref={(ele) => ref.current = ele}></div>
  );
});
