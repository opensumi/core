import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.module.less';
import { WorkbenchEditorService, IResource } from '../common';
import classnames from 'classnames';
import { ReactEditorComponent, IEditorComponent, EditorComponentRegistry } from './types';
import { Tabs } from './tab.view';
import { MaybeNull, URI } from '@ali/ide-core-browser';

export const EditorView = observer(() => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

  return (
    <div className={ styles.kt_workbench_editor } ref={(ele) => ref.current = ele}>
      {
        instance.editorGroups.map((group) => {
          return <EditorGroupView key={group.name} group={group} />;
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
      [styles.kt_hidden]: !(group.currentOpenType && group.currentOpenType.componentId === component.uid),
     })}>
       <ComponentWrapper key={component.uid} component={component} resources={resources} current={group.currentResource} ></ComponentWrapper>
     </div>);
  });

  return (
    <div className={styles.kt_editor_group}>
      <Tabs resources={group.resources}
            onActivate={(resource: IResource) => group.open(resource.uri)}
            currentResource={group.currentResource}
            onClose={(resource: IResource) => group.close(resource.uri)}
            onDragStart={(e, resource) => {
              e.dataTransfer.setData('uri', resource.uri.toString());
            }}
            onDrop={(e, target) => {
              if (e.dataTransfer.getData('uri')) {
                group.dropUri(new URI(e.dataTransfer.getData('uri')), target);
              }
            }}/>
      <div className={styles.kt_editor_body}>
        <div className={classnames({
          [styles.kt_editor_component]: true,
          [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'component',
        })}>
          {components}
        </div>
        <div className={classnames({
          [styles.kt_editor_component]: true,
          [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'code',
        })} ref={(ele) => codeEditorRef.current = ele}>
        </div>
      </div>

    </div>
  );
});

export const ComponentWrapper = observer(({component, resources, current}: {component: IEditorComponent, resources: IResource[], current: MaybeNull<IResource> }) => {
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
