import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.module.less';
import { WorkbenchEditorService, IResource } from '../common';
import classnames from 'classnames';
import { ReactEditorComponent, IEditorComponent, EditorComponentRegistry } from './types';

export const EditorView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

  return (
    <div className={ styles.kt_workbench_editor } ref={(ele) => ref.current = ele}>
      {
        instance.editorGroups.map((group) => {
          return <EditorGroupView group={group} />;
        })
      }
    </div>
  );
});

export const EditorGroupView = observer(({ group }: { group: EditorGroup }) => {
  const codeEditorRef = React.useRef<HTMLElement | null>();

  React.useEffect(() => {
    if (codeEditorRef.current) {
      group.createEditor(codeEditorRef.current);
    }
  }, [codeEditorRef]);

  const components: React.ReactNode[] = [];

  group.activeComponents.forEach((resources, component) => {
     components.push(
     <div key={component.uid} className={classnames({
      [styles.kt_hidden]: !(group.currentPayload && group.currentPayload.componentId === component.uid),
     })}>
       <ComponentWrapper key={component.uid} component={component} resources={resources} current={group.currentResource} ></ComponentWrapper>
     </div>);
  });

  return (
    <div className={styles.kt_editor_group}>
      <div className={classnames({
        [styles.kt_editor_component]: true,
        [styles.kt_hidden]: !group.currentPayload || group.currentPayload.type !== 'component',
      })}>
        {components}
      </div>
      <div className={classnames({
        [styles.kt_editor_component]: true,
        [styles.kt_hidden]: !group.currentPayload || group.currentPayload.type !== 'code',
      })} ref={(ele) => codeEditorRef.current = ele}></div>
    </div>
  );
});

export const ComponentWrapper = observer(({component, resources, current}: {component: IEditorComponent, resources: IResource[], current: IResource | undefined}) => {
  return <div className={styles.kt_editor_component_wrapper}>
    {resources.map((resource) => {
      return <div key={resource.uri.toString()}  className={classnames({
        [styles.kt_hidden]: !(current && current.uri.toString() === resource.uri.toString()),
       })}>
          <component.component resource={resource} />
       </div>;
    })}
  </div>;
});
