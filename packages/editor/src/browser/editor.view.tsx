import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';
import * as styles from './editor.module.less';
import { WorkbenchEditorService, IResource, IEditorOpenType } from '../common';
import classnames from 'classnames';
import { ReactEditorComponent, IEditorComponent, EditorComponentRegistry, GridResizeEvent, DragOverPosition, EditorGroupsResetSizeEvent, EditorComponentRenderMode } from './types';
import { Tabs } from './tab.view';
import { MaybeNull, URI, ConfigProvider, ConfigContext, IEventBus, AppConfig, ErrorBoundary, ComponentRegistry } from '@ali/ide-core-browser';
import { EditorGrid, SplitDirection } from './grid/grid.service';
import ReactDOM = require('react-dom');
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ResizeHandleHorizontal, ResizeHandleVertical, IResizeHandleDelegate } from './component/resize/resize';
import { Scroll } from './component/scroll/scroll';
import { EditorComponentRegistryImpl } from './component';
import { NavigationBar } from './navigation.view';

export const EditorView = () => {
  const ref = React.useRef<HTMLElement | null>();

  const instance = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const rightWidgetInfo = componentRegistry.getComponentRegistryInfo('editor-widget-right');
  const RightWidget: React.Component | React.FunctionComponent<any> | undefined = rightWidgetInfo && rightWidgetInfo.views[0].component;
  
  return (
    <div className={ styles.kt_workbench_editor } id='workbench-editor' ref={(ele) => ref.current = ele}>
      <div className={styles.kt_editor_main_wrapper}>
        <EditorGridView grid={instance.topGrid} ></EditorGridView>
      </div>
        { RightWidget ?
          <div className={styles.kt_editor_right_widget}>
            <ErrorBoundary>
              <RightWidget></RightWidget>
            </ErrorBoundary>
          </div> : null
       }
    </div>
  );
};

const cachedGroupView = {};

export const EditorGridView = observer( ({grid}: {grid: EditorGrid} ) => {
  let editorGroupContainer: HTMLDivElement;
  const context = React.useContext(ConfigContext);

  const eventBus = useInjectable(IEventBus) as IEventBus;
  const resizeDelegates: IResizeHandleDelegate[] = [];

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
    const disposer = eventBus.on(EditorGroupsResetSizeEvent, () => {
      if (grid.splitDirection && resizeDelegates.length > 0) {
        resizeDelegates.forEach((delegate) => {
          delegate.setSize(1 / grid.children.length, 1 / grid.children.length);
        });
      }
    });
    return () => {
      disposer.dispose();
    };
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
          children.push(<ResizeHandleVertical key={'resize-' +  grid.children[index - 1].uid + '-' + g.uid} onResize= {
            () => {
              grid.children[index - 1].emitResizeWithEventBus(eventBus);
              g.emitResizeWithEventBus(eventBus);
            }
          } delegate={(delegate) => {
            resizeDelegates.push(delegate);
          }}/>);
        } else {
          children.push(<ResizeHandleHorizontal key={'resize-' + grid.children[index - 1].uid + '-' + g.uid} onResize= {
            () => {
              grid.children[index - 1].emitResizeWithEventBus(eventBus);
              g.emitResizeWithEventBus(eventBus);
            }
          } delegate={(delegate) => {
            resizeDelegates.push(delegate);
          }}/>);
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
const cachedDiffEditor: {[key: string]: HTMLDivElement} = {};

export const EditorGroupView = observer(({ group }: { group: EditorGroup }) => {
  const codeEditorRef = React.useRef<HTMLElement | null>();
  const diffEditorRef = React.useRef<HTMLElement | null>();
  const editorBodyRef = React.useRef<HTMLElement | null>();
  const contextMenuRenderer = useInjectable(ContextMenuRenderer) as ContextMenuRenderer;
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;

  const appConfig = useInjectable(AppConfig);
  const {editorBackgroudImage} = appConfig;
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
    if (diffEditorRef.current) {
      if (cachedDiffEditor[group.name]) {
        cachedDiffEditor[group.name].remove();
        diffEditorRef.current.appendChild(cachedDiffEditor[group.name]);
      } else {
        const container = document.createElement('div');
        diffEditorRef.current.appendChild(container);
        cachedDiffEditor[group.name] = container;
        group.createDiffEditor(container);
      }
    }
  }, [codeEditorRef]);

  const components: React.ReactNode[] = [];

  group.activeComponents.forEach((resources, component) => {
     components.push(
     <div key={component.uid} className={classnames({
      [styles.kt_hidden]: !(group.currentOpenType && group.currentOpenType.componentId === component.uid),
     })}>
       <ComponentsWrapper key={component.uid} component={component} resources={resources} current={group.currentResource} ></ComponentsWrapper>
     </div>);
  });

  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const emptyComponentInfo = componentRegistry.getComponentRegistryInfo('editor-empty');
  const EmptyComponent: React.Component | React.FunctionComponent<any> | undefined = emptyComponentInfo && emptyComponentInfo.views[0].component;

  return (
    <div className={styles.kt_editor_group} tabIndex={1} onFocus={(e) => {
      group.gainFocus();
      }}
    >
      {group.resources.length === 0 && <div className={styles.kt_editor_background} style={{
          backgroundImage: editorBackgroudImage ? `url(${editorBackgroudImage})` : 'none',
        }}>
          {EmptyComponent ? <ErrorBoundary><EmptyComponent></EmptyComponent></ErrorBoundary> : undefined}
        </div>}
      {group.resources.length > 0 && 
      <div className={styles.editorGroupHeader}>
        <Tabs resources={group.resources}
              onActivate={(resource: IResource) => group.open(resource.uri)}
              currentResource={group.currentResource}
              gridId={() => group.grid.uid}
              previewUri= {group.previewURI}
              onClose={(resource: IResource) => group.close(resource.uri)}
              hasFocus={editorService.currentEditorGroup === group}
              onDragStart={(e, resource) => {
                e.dataTransfer.setData('uri', resource.uri.toString());
                e.dataTransfer.setData('uri-source-group', group.name);
              }}
              group={group}
              onDrop={(e, target) => {
                if (e.dataTransfer.getData('uri')) {
                  const uri = new URI(e.dataTransfer.getData('uri'));
                  let sourceGroup: EditorGroup | undefined;
                  if (e.dataTransfer.getData('uri-source-group')) {
                    sourceGroup = editorService.getEditorGroup(e.dataTransfer.getData('uri-source-group'));
                  }
                  group.dropUri(uri, DragOverPosition.CENTER, sourceGroup, target);
                }
              }}
              onContextMenu={(event, target) => {
                const { x, y } = event.nativeEvent;
                contextMenuRenderer.render(['editor'], { x, y, group, uri: target.uri });
                event.stopPropagation();
                event.preventDefault();
              }}
              onDbClick={(resource) => {
                  group.pinPreviewed(resource.uri);
                }}
              />
        <NavigationBar editorGroup={group} />
      </div>}
      <div className={styles.kt_editor_body}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (editorBodyRef.current) {
                      const position = getDragOverPosition(e.nativeEvent, editorBodyRef.current);
                      decorateDragOverElement(editorBodyRef.current, position);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (editorBodyRef.current) {
                      removeDecorationDragOverElement(editorBodyRef.current);
                    }
                  }}
                  onDrop={(e) => {
                    if (editorBodyRef.current) {
                      removeDecorationDragOverElement(editorBodyRef.current);
                      if (e.dataTransfer.getData('uri')) {
                        const uri = new URI(e.dataTransfer.getData('uri'));
                        let sourceGroup: EditorGroup | undefined;
                        if (e.dataTransfer.getData('uri-source-group')) {
                          sourceGroup = editorService.getEditorGroup(e.dataTransfer.getData('uri-source-group'));
                        }
                        group.dropUri(uri, getDragOverPosition(e.nativeEvent, editorBodyRef.current), sourceGroup);
                      }
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
        <div className={classnames({
          [styles.kt_editor_diff_editor]: true,
          [styles.kt_editor_component]: true,
          [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'diff',
        })} ref={(ele) => diffEditorRef.current = ele}>
        </div>
        <OpenTypeSwitcher options={group.availableOpenTypes} current={group.currentOpenType} group={group}/>
      </div>

    </div>
  );
});

export const ComponentsWrapper = observer(({component, resources, current}: {component: IEditorComponent, resources: IResource[], current: MaybeNull<IResource> }) => {
  return <div className={styles.kt_editor_component_wrapper}>
    {resources.map((resource) => {
      return <ComponentWrapper key={resource.toString()} component={component} resource={resource} hidden={!(current && current.uri.toString() === resource.uri.toString())} />;
    })}
  </div>;
});

export const ComponentWrapper = ({component, resource, hidden}) => {
  const componentService: EditorComponentRegistryImpl = useInjectable(EditorComponentRegistry);
  let containerRef: HTMLDivElement | null = null;
  let componentNode;
  if (component.renderMode !== EditorComponentRenderMode.ONE_PER_WORKBENCH) {
    componentNode = <component.component resource={resource} />;
  }
  const context = React.useContext(ConfigContext);

  React.useEffect(() => {
    if (component.renderMode === EditorComponentRenderMode.ONE_PER_WORKBENCH) {
      if (!componentService.perWorkbenchComponents[component.uid]) {
        const div = document.createElement('div');
        div.style.height = '100%';
        componentService.perWorkbenchComponents[component.uid] = div;
        // 对于per_workbench的，resource默认为不会改变
        ReactDOM.render(<ConfigProvider value={context}><component.component resource={resource} /></ConfigProvider>, div);
      }
      containerRef!.appendChild(componentService.perWorkbenchComponents[component.uid]);
    }
  });

  return <div key={resource.uri.toString()}  className={classnames({
    [styles.kt_hidden]: hidden,
   })}>
     <Scroll>
       <ErrorBoundary><div ref={(el) => { containerRef = el; }} style={{height: '100%'}}>{componentNode}</div></ErrorBoundary>;
     </Scroll>
   </div>;
};

export const OpenTypeSwitcher = ({options, current, group}: {options: IEditorOpenType[], current: MaybeNull<IEditorOpenType>, group: EditorGroup} ) => {
  if (options.length <= 1) {
    return null;
  }

  return <div className={styles.open_type_switcher}>
    {
      options.map((option, i) => {
        return <div className={classnames({
          [styles.option]: true,
          [styles.current_type]: current && current.type === option.type && current.componentId === option.componentId,
        })} onClick={() => {
          group.changeOpenType(option);
        }} key={i} >{option.title || option.componentId || option.type}</div>;
      })
    }
  </div>;
};

function getDragOverPosition(e: DragEvent, element: HTMLElement ): DragOverPosition {
  const rect = element.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (x < width * 0.15) {
    return DragOverPosition.LEFT;
  }
  if (x > width * 0.85) {
    return DragOverPosition.RIGHT;
  }
  if (y < height * 0.15 ) {
    return DragOverPosition.TOP;
  }
  if (y > height * 0.85 ) {
    return DragOverPosition.BOTTOM;
  }
  return DragOverPosition.CENTER;
}

function decorateDragOverElement(element: HTMLElement, position: DragOverPosition) {
  element.classList.add(styles.kt_on_drag_over);
  [DragOverPosition.LEFT, DragOverPosition.RIGHT, DragOverPosition.TOP, DragOverPosition.BOTTOM].forEach((pos) => {
    element.classList.remove(styles['kt_on_drag_over_' + pos]);
  });
  element.classList.add(styles['kt_on_drag_over_' + position]);
}

function removeDecorationDragOverElement(element: HTMLElement) {
  element.classList.remove(styles.kt_on_drag_over);
  [DragOverPosition.LEFT, DragOverPosition.RIGHT, DragOverPosition.TOP, DragOverPosition.BOTTOM].forEach((pos) => {
    element.classList.remove(styles['kt_on_drag_over_' + pos]);
  });
}