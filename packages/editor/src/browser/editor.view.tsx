import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.module.less';
import { WorkbenchEditorService, IResource } from '../common';
import classnames from 'classnames';
import { ReactEditorComponent, IEditorComponent, EditorComponentRegistry } from './types';
import { Tabs } from './tab.view';
import { MaybeNull, URI, ConfigProvider, ConfigContext } from '@ali/ide-core-browser';
import { EditorGrid, SplitDirection } from './grid/grid.service';
import ReactDOM = require('react-dom');
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ResizeHandleHorizontal, ResizeHandleVertical } from './component/resize/resize';
export const EditorView = () => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

  return (
    <div className={ styles.kt_workbench_editor } ref={(ele) => ref.current = ele}>
      <EditorGridView grid={instance.topGrid} ></EditorGridView>
    </div>
  );
};

const cachedGroupView = {};

export const EditorGridView = observer( ({grid}: {grid: EditorGrid} ) => {
  let editorGroupContainer: HTMLDivElement;
  const context = React.useContext(ConfigContext);
  React.useEffect(() => {
    if (editorGroupContainer) {
      if (cachedGroupView[grid.editorGroup!.name]) {
        editorGroupContainer.appendChild(cachedGroupView[grid.editorGroup!.name]);
      } else {
        const div = document.createElement('div');
        cachedGroupView[grid.editorGroup!.name] = div;
        div.style.height = '100%';
        editorGroupContainer.appendChild(div);
        ReactDOM.render(<ConfigProvider value={context}><EditorGroupView group={grid.editorGroup! as EditorGroup} /></ConfigProvider>, div);
      }
    }
  });

  if (grid.children.length === 0 && grid.editorGroup) {
    return <div style={{height: '100%'}} ref={(el) => el && (editorGroupContainer = el)}>
    </div>;
  } else {
    const defaultChildStyle = grid.splitDirection === SplitDirection.Horizontal ? {width: (100 / grid.children.length) + '%'} : {height: (100 / grid.children.length) + '%'};
    const children: any[] = [];
    grid.children.forEach((g, index) => {
      if (index !== 0) {
        if (grid.splitDirection === SplitDirection.Vertical) {
          children.push(<ResizeHandleVertical key={'resize-' +  g.uid}/>);
        } else {
          children.push(<ResizeHandleHorizontal key={'resize-' + g.uid}/>);
        }
      }
      children.push(<div className={classnames({
        [styles.kt_grid_vertical_child]: grid.splitDirection === SplitDirection.Vertical,
        [styles.kt_grid_horizontal_child]: grid.splitDirection === SplitDirection.Horizontal,
      })} style={defaultChildStyle} key={g.uid}>
        <EditorGridView grid={g}/>
      </div>);
    });
    return <div className={classnames({
        [styles.kt_grid_vertical]: grid.splitDirection === SplitDirection.Vertical,
        [styles.kt_grid_horizontal]: grid.splitDirection === SplitDirection.Horizontal,
      })}>
      {children}
    </div>;
  }
});

const cachedEditor: {[key: string]: HTMLDivElement} = {};

export const EditorGroupView = observer(({ group }: { group: EditorGroup }) => {
  const codeEditorRef = React.useRef<HTMLElement | null>();
  const editorBodyRef = React.useRef<HTMLElement | null>();
  const contextMenuRenderer = useInjectable(ContextMenuRenderer);
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

  React.useEffect(() => {
    if (codeEditorRef.current) {
      if (cachedEditor[group.name]) {
        cachedEditor[group.name].remove();
        codeEditorRef.current.appendChild(cachedEditor[group.name]);
      } else {
        const container = document.createElement('div');
        codeEditorRef.current.appendChild(container);
        cachedEditor[group.name] = container;
        group.createEditor(container);
      }

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
    <div className={styles.kt_editor_group} tabIndex={1} onFocus={(e) => {
      group.gainFocus();
    }}>
      <Tabs resources={group.resources}
            onActivate={(resource: IResource) => group.open(resource.uri)}
            currentResource={group.currentResource}
            onClose={(resource: IResource) => group.close(resource.uri)}
            onDragStart={(e, resource) => {
              e.dataTransfer.setData('uri', resource.uri.toString());
              e.dataTransfer.setData('uri-source-group', group.name);
            }}
            onDrop={(e, target) => {
              if (e.dataTransfer.getData('uri')) {
                const uri = new URI(e.dataTransfer.getData('uri'));
                if (e.dataTransfer.getData('uri-source-group')) {
                  const sourceGroup = editorService.getEditorGroup(e.dataTransfer.getData('uri-source-group'));
                  if (sourceGroup && sourceGroup !== group) {
                    sourceGroup.close(uri);
                  }
                }
                group.dropUri(uri, target);
              }
            }}
            onContextMenu={(event, target) => {
              group.contextResource = target;
              const { x, y } = event.nativeEvent;
              contextMenuRenderer.render(['editor'], { x, y });
              event.stopPropagation();
              event.preventDefault();
            }}
            />
      <div className={styles.kt_editor_body}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (editorBodyRef.current) {
                      editorBodyRef.current.classList.add(styles.kt_on_drag_over);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (editorBodyRef.current) {
                      editorBodyRef.current.classList.remove(styles.kt_on_drag_over);
                    }
                  }}
                  onDrop={(e) => {
                    if (editorBodyRef.current) {
                      editorBodyRef.current.classList.remove(styles.kt_on_drag_over);
                    }
                    if (e.dataTransfer.getData('uri')) {
                      const uri = new URI(e.dataTransfer.getData('uri'));
                      if (e.dataTransfer.getData('uri-source-group')) {
                        const sourceGroup = editorService.getEditorGroup(e.dataTransfer.getData('uri-source-group'));
                        if (sourceGroup && sourceGroup !== group) {
                          sourceGroup.close(uri);
                        }
                      }
                      group.dropUri(uri);
                    }
                  }}
                  ref={editorBodyRef as any}>
        <div className={classnames({
          [styles.kt_editor_component]: true,
          [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'component',
        })}>
          {components}
        </div>
        <div className={classnames({
          [styles.kt_editor_code_editor]: true,
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
