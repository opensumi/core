import cls from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Scrollbars } from '@opensumi/ide-components';
import {
  AppConfig,
  ComponentRegistry,
  ConfigContext,
  ConfigProvider,
  DisposableStore,
  ErrorBoundary,
  IEventBus,
  MaybeNull,
  URI,
  View,
  renderView,
  useDesignStyles,
  useDisposable,
  usePreference,
} from '@opensumi/ide-core-browser';
import {
  IResizeHandleDelegate,
  ResizeFlexMode,
  ResizeHandleHorizontal,
  ResizeHandleVertical,
} from '@opensumi/ide-core-browser/lib/components';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { useInjectable, useUpdateOnEventBusEvent } from '@opensumi/ide-core-browser/lib/react-hooks';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import { IResource, WorkbenchEditorService } from '../common';

import { EditorComponentRegistryImpl } from './component';
import { EditorContext, IEditorContext, defaultEditorContext } from './editor.context';
import styles from './editor.module.less';
import { EditorGrid, SplitDirection } from './grid/grid.service';
import { NavigationBar } from './navigation.view';
import { Tabs } from './tab.view';
import {
  CodeEditorDidVisibleEvent,
  DragOverPosition,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  EditorGroupFileDropEvent,
  EditorGroupsResetSizeEvent,
  EditorOpenType,
  EditorSide,
  IEditorComponent,
  RegisterEditorSideComponentEvent,
  ResoucesOfActiveComponentChangedEvent,
} from './types';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';

export const EditorView = () => {
  const ref = React.useRef<HTMLElement | null>();

  const workbenchEditorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const rightWidgetInfo = componentRegistry.getComponentRegistryInfo('editor-widget-right');
  const RightWidget: React.ComponentType<any> | undefined = rightWidgetInfo && rightWidgetInfo.views[0].component;
  const [ready, setReady] = React.useState<boolean>(workbenchEditorService.gridReady);
  const styles_kt_workbench_editor = useDesignStyles(styles.kt_workbench_editor, 'kt_workbench_editor');

  React.useEffect(() => {
    if (!ready) {
      if (workbenchEditorService.gridReady) {
        setReady(true);
      } else {
        const disposer = workbenchEditorService.onDidGridReady(() => {
          setReady(true);
        });
        return () => disposer.dispose();
      }
    }
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <div
      className={styles_kt_workbench_editor}
      id='workbench-editor'
      ref={(ele) => {
        ref.current = ele;
        if (ele) {
          workbenchEditorService.onDomCreated(ele);
        }
      }}
    >
      <div className={styles.kt_editor_main_wrapper}>
        <EditorGridView grid={workbenchEditorService.topGrid} />
      </div>
      {RightWidget ? (
        <div className={styles.kt_editor_right_widget}>
          <ErrorBoundary>
            <RightWidget />
          </ErrorBoundary>
        </div>
      ) : null}
    </div>
  );
};

const cachedGroupView = {};

export const EditorGridView = ({ grid }: { grid: EditorGrid }) => {
  let editorGroupContainer: HTMLDivElement;
  const context = React.useContext(ConfigContext);

  const eventBus = useInjectable(IEventBus) as IEventBus;
  const resizeDelegates: IResizeHandleDelegate[] = [];
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    if (editorGroupContainer) {
      if (cachedGroupView[grid.editorGroup!.name]) {
        editorGroupContainer.appendChild(cachedGroupView[grid.editorGroup!.name]);
        (grid.editorGroup! as EditorGroup).layoutEditors();
      } else {
        const div = document.createElement('div');
        cachedGroupView[grid.editorGroup!.name] = div;
        div.style.height = '100%';
        editorGroupContainer.appendChild(div);
        ReactDOM.createRoot(div).render(
          <ConfigProvider value={context}>
            <EditorGroupView group={grid.editorGroup! as EditorGroup} />
          </ConfigProvider>,
        );
      }
    }
  });

  useDisposable(
    () => [
      eventBus.on(EditorGroupsResetSizeEvent, () => {
        if (grid.splitDirection && resizeDelegates.length > 0) {
          resizeDelegates.forEach((delegate) => {
            delegate.setSize(1 / grid.children.length, 1 / grid.children.length);
          });
        }
      }),
      grid.onDidGridStateChange(() => {
        forceUpdate();
      }),
    ],
    [],
  );

  if (grid.children.length === 0 && grid.editorGroup) {
    return <div style={{ height: '100%' }} ref={(el) => el && (editorGroupContainer = el)} />;
  }

  const defaultChildStyle =
    grid.splitDirection === SplitDirection.Horizontal
      ? { width: 100 / grid.children.length + '%' }
      : { height: 100 / grid.children.length + '%' };
  const children: any[] = [];
  grid.children.forEach((g, index) => {
    if (index !== 0) {
      if (grid.splitDirection === SplitDirection.Vertical) {
        children.push(
          <ResizeHandleVertical
            key={'resize-' + grid.children[index - 1].uid + '-' + g.uid}
            onResize={() => {
              grid.children[index - 1].emitResizeWithEventBus(eventBus);
              g.emitResizeWithEventBus(eventBus);
            }}
            delegate={(delegate) => {
              resizeDelegates.push(delegate);
            }}
            flexMode={ResizeFlexMode.Percentage}
          />,
        );
      } else {
        children.push(
          <ResizeHandleHorizontal
            key={'resize-' + grid.children[index - 1].uid + '-' + g.uid}
            onResize={() => {
              grid.children[index - 1].emitResizeWithEventBus(eventBus);
              g.emitResizeWithEventBus(eventBus);
            }}
            delegate={(delegate) => {
              resizeDelegates.push(delegate);
            }}
          />,
        );
      }
    }
    children.push(
      <div
        className={cls({
          [styles.kt_grid_vertical_child]: grid.splitDirection === SplitDirection.Vertical,
          [styles.kt_grid_horizontal_child]: grid.splitDirection === SplitDirection.Horizontal,
        })}
        style={defaultChildStyle}
        key={g.uid}
        data-min-resize={grid.splitDirection === SplitDirection.Horizontal ? 150 : 60}
      >
        <EditorGridView grid={g} />
      </div>,
    );
  });

  return (
    <div
      className={cls({
        [styles.kt_grid_vertical]: grid.splitDirection === SplitDirection.Vertical,
        [styles.kt_grid_horizontal]: grid.splitDirection === SplitDirection.Horizontal,
      })}
    >
      {children}
    </div>
  );
};

const cachedEditor: { [key: string]: HTMLDivElement } = {};

/**
 * 默认的 editor empty component
 * 接受外部的 editorBackgroundImage 作为图片展示
 */
const EditorEmptyComponent: React.FC<{
  editorBackgroundImage: string;
}> = ({ editorBackgroundImage }) => {
  if (!editorBackgroundImage) {
    return null;
  }

  return (
    <div className={styles.editorEmpty}>
      <img className={styles.editorEmptyImg} src={editorBackgroundImage} />
    </div>
  );
};

export const EditorGroupView = ({ group }: { group: EditorGroup }) => {
  const groupWrapperRef = React.useRef<HTMLElement | null>();

  const [isEmpty, setIsEmpty] = React.useState(group.resources.length === 0);
  const styles_kt_editor_group = useDesignStyles(styles.kt_editor_group, 'kt_editor_group');

  const appConfig = useInjectable(AppConfig);
  const { editorBackgroundImage } = appConfig;

  React.useEffect(() => {
    group.attachToDom(groupWrapperRef.current);
  });

  React.useEffect(() => {
    // 由于当前可能已经发生改变，因此需要再检查一次
    setIsEmpty(group.resources.length === 0);
    const disposer = group.onDidEditorGroupTabChanged(() => {
      setIsEmpty(group.resources.length === 0);
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  const showActionWhenGroupEmpty = usePreference('editor.showActionWhenGroupEmpty', false);

  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);

  // TODO: 将图片转换成默认的 editor component
  const EmptyEditorViewConfig = React.useMemo(() => {
    const emptyComponentInfo = componentRegistry.getComponentRegistryInfo('editor-empty');
    return (
      (emptyComponentInfo && emptyComponentInfo.views[0]) ||
      ({
        component: EditorEmptyComponent,
        initialProps: { editorBackgroundImage },
      } as View)
    );
  }, []);

  return (
    <div
      ref={groupWrapperRef as any}
      className={styles_kt_editor_group}
      tabIndex={1}
      onFocus={(e) => {
        group.gainFocus();
      }}
    >
      {(!isEmpty || showActionWhenGroupEmpty) && (
        <div className={styles.editorGroupHeader}>
          <Tabs group={group} />
        </div>
      )}
      <EditorGroupBody group={group} />
      {isEmpty && (
        <div
          className={styles.kt_editor_background}
          style={{
            backgroundImage: !EmptyEditorViewConfig && editorBackgroundImage ? `url(${editorBackgroundImage})` : 'none',
          }}
        >
          {renderView(EmptyEditorViewConfig)}
        </div>
      )}
    </div>
  );
};

export const EditorGroupBody = ({ group }: { group: EditorGroup }) => {
  const [context, setContext] = React.useState<IEditorContext>(defaultEditorContext);

  const editorBodyRef = React.useRef<HTMLDivElement>(null);
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;
  const eventBus = useInjectable(IEventBus) as IEventBus;
  const styles_kt_editor_component = useDesignStyles(styles.kt_editor_component, 'kt_editor_component');
  const components: React.ReactNode[] = [];
  const codeEditorRef = React.useRef<HTMLDivElement>(null);
  const diffEditorRef = React.useRef<HTMLDivElement>(null);
  const mergeEditorRef = React.useRef<HTMLDivElement>(null);
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    const disposables = new DisposableStore();

    disposables.add(
      group.onDidEditorGroupBodyChanged(() => {
        forceUpdate();
      }),
    );

    if (codeEditorRef.current) {
      if (cachedEditor[group.name]) {
        cachedEditor[group.name].remove();
        codeEditorRef.current.appendChild(cachedEditor[group.name]);
      } else {
        const container = document.createElement('div');
        codeEditorRef.current.appendChild(container);
        cachedEditor[group.name] = container;
        group.createEditor(container);
        const minimapWith = group.codeEditor.monacoEditor.getOption(monaco.editor.EditorOption.layoutInfo).minimap
          .minimapWidth;
        setContext({ minimapWidth: minimapWith });

        disposables.add(
          group.codeEditor.monacoEditor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(monaco.editor.EditorOption.layoutInfo)) {
              setContext({
                minimapWidth: group.codeEditor.monacoEditor.getOption(monaco.editor.EditorOption.layoutInfo).minimap
                  .minimapWidth,
              });
            }
          }),
        );
      }
    }

    if (diffEditorRef.current) {
      group.attachDiffEditorDom(diffEditorRef.current);
    }
    if (mergeEditorRef.current) {
      group.attachMergeEditorDom(mergeEditorRef.current);
    }

    return () => {
      disposables.dispose();
    };
  }, []);

  group.activeComponents.forEach((resources, component) => {
    const initialProps = group.activateComponentsProps.get(component);
    components.push(
      <div
        key={component.uid}
        className={cls({
          [styles.kt_hidden]: !(group.currentOpenType && group.currentOpenType.componentId === component.uid),
        })}
      >
        <ComponentsWrapper
          key={component.uid}
          component={component}
          {...initialProps}
          resources={resources}
          current={group.currentResource}
        ></ComponentsWrapper>
      </div>,
    );
  });

  const editorHasNoTab = React.useMemo(
    () => group.resources.length === 0 || !group.currentResource,
    [group.resources.length, group.currentResource],
  );

  React.useEffect(() => {
    if (group.currentOpenType?.type === EditorOpenType.code) {
      eventBus.fire(
        new CodeEditorDidVisibleEvent({
          groupName: group.name,
          type: EditorOpenType.code,
          editorId: group.codeEditor.getId(),
        }),
      );
    } else if (group.currentOpenType?.type === EditorOpenType.diff) {
      eventBus.fire(
        new CodeEditorDidVisibleEvent({
          groupName: group.name,
          type: EditorOpenType.diff,
          editorId: group.diffEditor.modifiedEditor.getId(),
        }),
      );
    }
  });

  return (
    <EditorContext.Provider value={context}>
      <div
        id={VIEW_CONTAINERS.EDITOR}
        ref={editorBodyRef}
        className={styles.kt_editor_body}
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
            if (e.dataTransfer.files.length > 0) {
              eventBus.fire(
                new EditorGroupFileDropEvent({
                  group,
                  files: e.dataTransfer.files,
                  position: getDragOverPosition(e.nativeEvent, editorBodyRef.current),
                }),
              );
            }
          }
        }}
      >
        {group.currentResource && <EditorSideView side={'top'} resource={group.currentResource}></EditorSideView>}
        {!editorHasNoTab && <NavigationBar editorGroup={group} />}
        <div className={styles.kt_editor_components}>
          <div
            className={cls({
              [styles_kt_editor_component]: true,
              [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== EditorOpenType.component,
            })}
          >
            {components}
          </div>
          <div
            className={cls({
              [styles.kt_editor_code_editor]: true,
              [styles_kt_editor_component]: true,
              [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== EditorOpenType.code,
            })}
            ref={codeEditorRef}
          />
          <div
            className={cls(styles.kt_editor_diff_editor, styles_kt_editor_component, {
              [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== EditorOpenType.diff,
            })}
            ref={diffEditorRef}
          />
          <div
            className={cls(styles.kt_editor_diff_3_editor, styles_kt_editor_component, {
              [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== EditorOpenType.mergeEditor,
            })}
            ref={mergeEditorRef}
          />
        </div>
        {group.currentResource && <EditorSideView side={'bottom'} resource={group.currentResource}></EditorSideView>}
      </div>
    </EditorContext.Provider>
  );
};

export const ComponentsWrapper = ({
  component,
  resources,
  current,
  ...other
}: {
  component: IEditorComponent;
  resources: IResource[];
  current: MaybeNull<IResource>;
}) => {
  useUpdateOnEventBusEvent(ResoucesOfActiveComponentChangedEvent, [component], (t) => t.component === component);
  return (
    <div className={styles.kt_editor_component_wrapper}>
      {resources.map((resource) => (
        <ComponentWrapper
          {...other}
          key={resource.uri.toString()}
          component={component}
          resource={resource}
          hidden={!(current && current.uri.toString() === resource.uri.toString())}
        />
      ))}
    </div>
  );
};

export const ComponentWrapper = ({ component, resource, hidden, ...other }) => {
  const componentService: EditorComponentRegistryImpl = useInjectable(EditorComponentRegistry);
  let containerRef: HTMLDivElement | null = null;
  let componentNode;
  if (component.renderMode !== EditorComponentRenderMode.ONE_PER_WORKBENCH) {
    componentNode = <component.component resource={resource} {...other} />;
  }
  const context = React.useContext(ConfigContext);

  React.useEffect(() => {
    if (component.renderMode === EditorComponentRenderMode.ONE_PER_WORKBENCH) {
      if (!componentService.perWorkbenchComponents[component.uid]) {
        const div = document.createElement('div');
        div.style.height = '100%';
        componentService.perWorkbenchComponents[component.uid] = div;
        // 对于per_workbench的，resource默认为不会改变
        ReactDOM.createRoot(div).render(
          <ConfigProvider value={context}>
            <component.component resource={resource} />
          </ConfigProvider>,
        );
      }
      containerRef!.appendChild(componentService.perWorkbenchComponents[component.uid]);
    }
  });

  return (
    <div
      key={resource.uri.toString()}
      className={cls({
        [styles.kt_hidden]: hidden,
      })}
    >
      <Scrollbars>
        <ErrorBoundary>
          <div
            ref={(el) => {
              containerRef = el;
            }}
            style={{ height: '100%' }}
          >
            {componentNode}
          </div>
        </ErrorBoundary>
      </Scrollbars>
    </div>
  );
};

function getDragOverPosition(e: DragEvent, element: HTMLElement): DragOverPosition {
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
  if (y < height * 0.15) {
    return DragOverPosition.TOP;
  }
  if (y > height * 0.85) {
    return DragOverPosition.BOTTOM;
  }
  return DragOverPosition.CENTER;
}

function addClass(element: HTMLElement, className: string) {
  if (!element.classList.contains(className)) {
    element.classList.add(className);
  }
}

function removeClass(element: HTMLElement, className: string) {
  if (element.classList.contains(className)) {
    element.classList.remove(className);
  }
}

function decorateDragOverElement(element: HTMLElement, position: DragOverPosition) {
  addClass(element, styles.kt_on_drag_over);
  [DragOverPosition.LEFT, DragOverPosition.RIGHT, DragOverPosition.TOP, DragOverPosition.BOTTOM]
    .filter((pos) => pos !== position)
    .forEach((pos) => {
      removeClass(element, styles['kt_on_drag_over_' + pos]);
    });
  addClass(element, styles['kt_on_drag_over_' + position]);
}

function removeDecorationDragOverElement(element: HTMLElement) {
  removeClass(element, styles.kt_on_drag_over);
  [DragOverPosition.LEFT, DragOverPosition.RIGHT, DragOverPosition.TOP, DragOverPosition.BOTTOM].forEach((pos) => {
    removeClass(element, styles['kt_on_drag_over_' + pos]);
  });
}

const EditorSideView = ({ side, resource }: { side: EditorSide; resource: IResource }) => {
  const componentRegistry: EditorComponentRegistry = useInjectable(EditorComponentRegistry);
  const eventBus = useInjectable(IEventBus) as IEventBus;
  const widgets = componentRegistry.getSideWidgets(side, resource);
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  useDisposable(() => eventBus.on(RegisterEditorSideComponentEvent, forceUpdate), []);

  return (
    <div className={cls(styles['kt_editor_side_widgets'], styles['kt_editor_side_widgets_' + side])}>
      {widgets.map((widget) => {
        const C = widget.component;
        return <C resource={resource} key={widget.id} {...(widget.initialProps || {})}></C>;
      })}
    </div>
  );
};
