import classnames from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';
import ReactDOM from 'react-dom';
import ReactIs from 'react-is';

import {
  AppConfig,
  ComponentRegistry,
  ConfigContext,
  ConfigProvider,
  ErrorBoundary,
  IEventBus,
  MaybeNull,
  PreferenceService,
  URI,
  useDisposable,
  View,
} from '@opensumi/ide-core-browser';
import {
  IResizeHandleDelegate,
  ResizeFlexMode,
  ResizeHandleHorizontal,
  ResizeHandleVertical,
} from '@opensumi/ide-core-browser/lib/components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';


import { IEditorOpenType, IResource, WorkbenchEditorService } from '../common';

import { EditorComponentRegistryImpl } from './component';
import { Scroll } from './component/scroll/scroll';
import styles from './editor.module.less';
import { EditorGrid, SplitDirection } from './grid/grid.service';
import { NavigationBar } from './navigation.view';
import { Tabs } from './tab.view';
import {
  DragOverPosition,
  EditorComponentRegistry,
  EditorComponentRenderMode,
  EditorGroupFileDropEvent,
  EditorGroupsResetSizeEvent,
  RegisterEditorSideComponentEvent,
  EditorSide,
  IEditorComponent,
  CodeEditorDidVisibleEvent,
} from './types';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';

export const EditorView = () => {
  const ref = React.useRef<HTMLElement | null>();

  const workbenchEditorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;
  const componentRegistry = useInjectable<ComponentRegistry>(ComponentRegistry);
  const rightWidgetInfo = componentRegistry.getComponentRegistryInfo('editor-widget-right');
  const RightWidget: React.ComponentType<any> | undefined = rightWidgetInfo && rightWidgetInfo.views[0].component;
  const [ready, setReady] = React.useState<boolean>(workbenchEditorService.gridReady);

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
      className={styles.kt_workbench_editor}
      id='workbench-editor'
      ref={(ele) => {
        ref.current = ele;
        if (ele) {
          workbenchEditorService.onDomCreated(ele);
        }
      }}
    >
      <div className={styles.kt_editor_main_wrapper}>
        <EditorGridView grid={workbenchEditorService.topGrid}></EditorGridView>
      </div>
      {RightWidget ? (
        <div className={styles.kt_editor_right_widget}>
          <ErrorBoundary>
            <RightWidget></RightWidget>
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
        ReactDOM.render(
          <ConfigProvider value={context}>
            <EditorGroupView group={grid.editorGroup! as EditorGroup} />
          </ConfigProvider>,
          div,
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
        className={classnames({
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
      className={classnames({
        [styles.kt_grid_vertical]: grid.splitDirection === SplitDirection.Vertical,
        [styles.kt_grid_horizontal]: grid.splitDirection === SplitDirection.Horizontal,
      })}
    >
      {children}
    </div>
  );
};

const cachedEditor: { [key: string]: HTMLDivElement } = {};
const cachedDiffEditor: { [key: string]: HTMLDivElement } = {};

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

export const EditorGroupView = observer(({ group }: { group: EditorGroup }) => {
  const groupWrapperRef = React.useRef<HTMLElement | null>();

  const preferenceService = useInjectable(PreferenceService) as PreferenceService;
  const [isEmpty, setIsEmpty] = React.useState(group.resources.length === 0);

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
    return disposer.dispose.bind(disposer);
  }, []);

  const [showActionWhenGroupEmpty, setShowActionWhenGroupEmpty] = React.useState(
    () => !!preferenceService.get<boolean>('editor.showActionWhenGroupEmpty'),
  );

  useDisposable(
    () => [
      preferenceService.onPreferenceChanged((change) => {
        if (change.preferenceName === 'editor.showActionWhenGroupEmpty') {
          setShowActionWhenGroupEmpty(!!change.newValue);
        }
      }),
    ],
    [],
  );

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
      className={styles.kt_editor_group}
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
          {EmptyEditorViewConfig && ReactIs.isValidElementType(EmptyEditorViewConfig.component) ? (
            <ErrorBoundary>
              {React.createElement(EmptyEditorViewConfig.component, EmptyEditorViewConfig.initialProps)}
            </ErrorBoundary>
          ) : null}
        </div>
      )}
    </div>
  );
});

export const EditorGroupBody = observer(({ group }: { group: EditorGroup }) => {
  const editorBodyRef = React.useRef<HTMLDivElement>(null);
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorServiceImpl;
  const eventBus = useInjectable(IEventBus) as IEventBus;
  const components: React.ReactNode[] = [];
  const codeEditorRef = React.useRef<HTMLDivElement>(null);
  const diffEditorRef = React.useRef<HTMLDivElement>(null);
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

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
  }, [codeEditorRef.current]);

  useDisposable(
    () =>
      group.onDidEditorGroupBodyChanged(() => {
        forceUpdate();
      }),
    [],
  );

  group.activeComponents.forEach((resources, component) => {
    const initialProps = group.activateComponentsProps.get(component);
    components.push(
      <div
        key={component.uid}
        className={classnames({
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
    if (group.currentOpenType?.type === 'code') {
      eventBus.fire(
        new CodeEditorDidVisibleEvent({
          groupName: group.name,
          type: 'code',
          editorId: group.codeEditor.getId(),
        }),
      );
    } else if (group.currentOpenType?.type === 'diff') {
      eventBus.fire(
        new CodeEditorDidVisibleEvent({
          groupName: group.name,
          type: 'diff',
          editorId: group.diffEditor.modifiedEditor.getId(),
        }),
      );
    }
  });

  return (
    <div
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
      {!editorHasNoTab && <NavigationBar editorGroup={group} />}
      <div className={styles.kt_editor_components}>
        <div
          className={classnames({
            [styles.kt_editor_component]: true,
            [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'component',
          })}
        >
          {components}
        </div>
        <div
          className={classnames({
            [styles.kt_editor_code_editor]: true,
            [styles.kt_editor_component]: true,
            [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'code',
          })}
          ref={codeEditorRef}
        />
        <div
          className={classnames(styles.kt_editor_diff_editor, styles.kt_editor_component, {
            [styles.kt_hidden]: !group.currentOpenType || group.currentOpenType.type !== 'diff',
          })}
          ref={diffEditorRef}
        />
      </div>
      {group.currentResource && <EditorSideView side={'bottom'} resource={group.currentResource}></EditorSideView>}
      <OpenTypeSwitcher options={group.availableOpenTypes} current={group.currentOpenType} group={group} />
    </div>
  );
});

export const ComponentsWrapper = ({
  component,
  resources,
  current,
  ...other
}: {
  component: IEditorComponent;
  resources: IResource[];
  current: MaybeNull<IResource>;
}) => (
  <div className={styles.kt_editor_component_wrapper}>
    {resources.map((resource) => (
      <ComponentWrapper
        {...other}
        key={resource.toString()}
        component={component}
        resource={resource}
        hidden={!(current && current.uri.toString() === resource.uri.toString())}
      />
    ))}
  </div>
);

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
        ReactDOM.render(
          <ConfigProvider value={context}>
            <component.component resource={resource} />
          </ConfigProvider>,
          div,
        );
      }
      containerRef!.appendChild(componentService.perWorkbenchComponents[component.uid]);
    }
  });

  return (
    <div
      key={resource.uri.toString()}
      className={classnames({
        [styles.kt_hidden]: hidden,
      })}
    >
      <Scroll>
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
      </Scroll>
    </div>
  );
};

export const OpenTypeSwitcher = observer(
  ({
    options,
    current,
    group,
  }: {
    options: IEditorOpenType[];
    current: MaybeNull<IEditorOpenType>;
    group: EditorGroup;
  }) => {
    if (options.length <= 1) {
      return null;
    }

    return (
      <div className={styles.open_type_switcher}>
        {options.map((option, i) => (
          <div
            className={classnames({
              [styles.option]: true,
              [styles.current_type]:
                current && current.type === option.type && current.componentId === option.componentId,
            })}
            onClick={() => {
              group.changeOpenType(option);
            }}
            key={i}
          >
            {option.title || option.componentId || option.type}
          </div>
        ))}
      </div>
    );
  },
);

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
    <div className={classnames(styles['kt_editor_side_widgets'], styles['kt_editor_side_widgets_' + side])}>
      {widgets.map((widget) => {
        const C = widget.component;
        return <C resource={resource} key={widget.id} {...widget.initialProps}></C>;
      })}
    </div>
  );
};
