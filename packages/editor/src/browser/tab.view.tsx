import classnames from 'classnames';
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useContext,
  useMemo,
  forwardRef,
  DragEvent,
  HTMLAttributes,
  Ref,
  MouseEvent,
} from 'react';

import { Scrollbars } from '@opensumi/ide-components';
import {
  getIcon,
  MaybeNull,
  IEventBus,
  getSlotLocation,
  ConfigContext,
  ResizeEvent,
  URI,
  Disposable,
  DomListener,
  PreferenceService,
  DisposableCollection,
  Event,
  getExternalIcon,
} from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable, useUpdateOnEventBusEvent } from '@opensumi/ide-core-browser/lib/react-hooks';

import { IResource, ResourceService, IEditorGroup, WorkbenchEditorService, ResourceDidUpdateEvent } from '../common';

import styles from './editor.module.less';
import { TabTitleMenuService } from './menu/title-context.menu';
import { GridResizeEvent, IEditorActionRegistry, DragOverPosition, EditorGroupFileDropEvent } from './types';
import { useUpdateOnGroupTabChange } from './view/react-hook';
import { EditorGroup, WorkbenchEditorServiceImpl } from './workbench-editor.service';

const pkgName = require('../../package.json').name;

export interface ITabsProps {
  group: EditorGroup;
}

export const Tabs = ({ group }: ITabsProps) => {
  const tabContainer = useRef<HTMLDivElement | null>();
  const tabWrapperRef = useRef<HTMLDivElement | null>();
  const contentRef = useRef<HTMLDivElement | null>();
  const editorActionUpdateTimer = useRef<any>(null);
  const editorActionRef = useRef<typeof EditorActions>(null);
  const resourceService = useInjectable(ResourceService) as ResourceService;
  const eventBus = useInjectable(IEventBus) as IEventBus;
  const configContext = useContext(ConfigContext);
  const editorService: WorkbenchEditorServiceImpl = useInjectable(WorkbenchEditorService);
  const tabTitleMenuService = useInjectable(TabTitleMenuService) as TabTitleMenuService;
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const menuRegistry = useInjectable<IMenuRegistry>(IMenuRegistry);

  const [tabsLoadingMap, setTabsLoadingMap] = useState<{ [resource: string]: boolean }>({});
  const [wrapMode, setWrapMode] = useState<boolean>(!!preferenceService.get<boolean>('editor.wrapTab'));
  const [tabMap, setTabMap] = useState<Map<number, boolean>>(new Map());
  const [lastMarginRight, setLastMarginRight] = useState<number | undefined>();

  const slotLocation = useMemo(() => getSlotLocation(pkgName, configContext.layoutConfig), []);

  useUpdateOnGroupTabChange(group);
  useUpdateOnEventBusEvent(
    ResourceDidUpdateEvent,
    [group.resources],
    (uri) => !!contentRef && group.resources.findIndex((r) => r.uri.isEqual(uri)) !== -1,
  );

  useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(
      group.onDidEditorGroupContentLoading((resource) => {
        group.resourceStatus.get(resource)?.finally(() => {
          setTabsLoadingMap(
            Object.assign({}, tabsLoadingMap, {
              [resource.uri.toString()]: false,
            }),
          );
        });
        setTabsLoadingMap(
          Object.assign({}, tabsLoadingMap, {
            [resource.uri.toString()]: true,
          }),
        );
      }),
    );
    disposer.addDispose(
      group.onDidEditorGroupTabChanged(() => {
        if (!wrapMode) {
          scrollToCurrent();
        }
      }),
    );
    return () => {
      disposer.dispose();
    };
  }, [group]);

  const onDrop = useCallback(
    (e: DragEvent, index: number, target?: IResource) => {
      if (e.dataTransfer.getData('uri')) {
        const uri = new URI(e.dataTransfer.getData('uri'));
        let sourceGroup: EditorGroup | undefined;
        if (e.dataTransfer.getData('uri-source-group')) {
          sourceGroup = editorService.getEditorGroup(e.dataTransfer.getData('uri-source-group'));
        }
        group.dropUri(uri, DragOverPosition.CENTER, sourceGroup, target);
      }
      if (e.dataTransfer.files.length > 0) {
        eventBus.fire(
          new EditorGroupFileDropEvent({
            group,
            tabIndex: index,
            files: e.dataTransfer.files,
          }),
        );
      }
    },
    [group],
  );

  const scrollToCurrent = useCallback(() => {
    if (tabContainer.current) {
      if (group.currentResource) {
        try {
          const currentTab = tabContainer.current.querySelector(
            '.' + styles.kt_editor_tab + "[data-uri='" + group.currentResource.uri.toString() + "']",
          );
          if (currentTab) {
            currentTab.scrollIntoView();
          }
        } catch (e) {
          // noop
        }
      }
    }
  }, [group, tabContainer.current]);

  const updateTabMarginRight = useCallback(() => {
    if (editorActionUpdateTimer.current) {
      clearTimeout(editorActionUpdateTimer.current);
      editorActionUpdateTimer.current = null;
    }
    const timer = setTimeout(() => {
      if (editorActionRef.current?.offsetWidth !== lastMarginRight) {
        setLastMarginRight(editorActionRef.current?.offsetWidth);
      }
    }, 200);
    editorActionUpdateTimer.current = timer;
  }, [editorActionRef.current, editorActionUpdateTimer.current, lastMarginRight]);

  useEffect(() => {
    if (!wrapMode) {
      queueMicrotask(() => {
        scrollToCurrent();
      });
    }
  }, [wrapMode, tabContainer.current]);

  useEffect(() => {
    if (!wrapMode) {
      const disposer = new Disposable();
      if (tabContainer.current) {
        disposer.addDispose(new DomListener(tabContainer.current, 'mousewheel', preventNavigation));
      }
      disposer.addDispose(
        eventBus.on(ResizeEvent, (event) => {
          if (event.payload.slotLocation === slotLocation) {
            scrollToCurrent();
          }
        }),
      );
      disposer.addDispose(
        eventBus.on(GridResizeEvent, (event) => {
          if (event.payload.gridId === group.grid.uid) {
            scrollToCurrent();
          }
        }),
      );
      return () => {
        disposer.dispose();
      };
    }
  }, [wrapMode]);

  const layoutLastInRow = useCallback(() => {
    if (contentRef.current && wrapMode) {
      const newMap: Map<number, boolean> = new Map();

      let currentTabY: number | undefined;
      let lastTab: HTMLDivElement | undefined;
      const tabs = Array.from(contentRef.current.children);
      // 最后一个元素是editorAction
      tabs.pop();
      tabs.forEach((child: HTMLDivElement) => {
        if (child.offsetTop !== currentTabY) {
          currentTabY = child.offsetTop;
          if (lastTab) {
            newMap.set(tabs.indexOf(lastTab), true);
          }
        }
        lastTab = child;
        newMap.set(tabs.indexOf(child), false);
      });
      // 最后一个 tab 不做 grow 处理
      setTabMap(newMap);
    }
  }, [contentRef.current, wrapMode]);

  useEffect(() => {
    updateTabMarginRight();
  }, [editorActionRef.current, wrapMode]);

  useEffect(layoutLastInRow, [wrapMode, contentRef.current, group, group.resources.length]);
  useEffect(() => {
    const disposable = new DisposableCollection();
    disposable.push(
      eventBus.on(ResizeEvent, (e) => {
        if (e.payload.slotLocation === slotLocation) {
          layoutLastInRow();
        }
      }),
    );
    disposable.push(
      preferenceService.onPreferenceChanged((e) => {
        if (e.preferenceName === 'editor.wrapTab') {
          setWrapMode(!!e.newValue);
        }
      }),
    );
    // 当前选中的group变化时宽度变化
    disposable.push(
      editorService.onDidCurrentEditorGroupChanged(() => {
        window.requestAnimationFrame(updateTabMarginRight);
      }),
    );
    // editorMenu变化时宽度可能变化
    disposable.push(
      Event.debounce(
        Event.filter(menuRegistry.onDidChangeMenu, (menuId) => menuId === MenuId.EditorTitle),
        () => {},
        200,
      )(() => {
        window.requestAnimationFrame(updateTabMarginRight);
      }),
    );

    return () => {
      disposable.dispose();
    };
  }, []);

  useEffect(() => {
    const disposableCollection = new DisposableCollection();
    disposableCollection.push(
      group.onDidEditorFocusChange((event) => {
        updateTabMarginRight();
      }),
    );
    return () => {
      disposableCollection.dispose();
    };
  }, [group]);

  const handleWrapperDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (tabWrapperRef.current) {
        tabWrapperRef.current.classList.add(styles.kt_on_drag_over);
      }
    },
    [tabWrapperRef.current],
  );

  const handleWrapperDragLeave = useCallback(
    (e: DragEvent) => {
      if (tabWrapperRef.current) {
        tabWrapperRef.current.classList.remove(styles.kt_on_drag_over);
      }
    },
    [tabWrapperRef.current],
  );

  const handleWrapperDrag = useCallback(
    (e: DragEvent) => {
      if (tabWrapperRef.current) {
        tabWrapperRef.current.classList.remove(styles.kt_on_drag_over);
      }
      if (onDrop) {
        onDrop(e, -1);
      }
    },
    [onDrop, tabWrapperRef.current],
  );

  const handleEmptyDBClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        editorService.createUntitledResource();
      }
    },
    [editorService],
  );

  const renderTabContent = () => (
    <div className={styles.kt_editor_tabs_content} ref={contentRef as any}>
      {group.resources.map((resource, i) => {
        let ref: HTMLDivElement | null;
        const decoration = resourceService.getResourceDecoration(resource.uri);
        const subname = resourceService.getResourceSubname(resource, group.resources);
        return (
          <div
            draggable={true}
            title={resource.title}
            className={classnames({
              [styles.kt_editor_tab]: true,
              [styles.last_in_row]: tabMap.get(i),
              [styles.kt_editor_tab_current]: group.currentResource === resource,
              [styles.kt_editor_tab_preview]: group.previewURI && group.previewURI.isEqual(resource.uri),
            })}
            style={
              wrapMode && i === group.resources.length - 1
                ? { marginRight: lastMarginRight, height: LAYOUT_VIEW_SIZE.EDITOR_TABS_HEIGHT }
                : {
                    height:
                      group.currentResource === resource
                        ? LAYOUT_VIEW_SIZE.EDITOR_TABS_HEIGHT + 1
                        : LAYOUT_VIEW_SIZE.EDITOR_TABS_HEIGHT,
                  }
            }
            onContextMenu={(event) => {
              tabTitleMenuService.show(event.nativeEvent.x, event.nativeEvent.y, resource && resource.uri, group);
              event.preventDefault();
            }}
            key={resource.uri.toString()}
            onMouseUp={(e) => {
              if (e.nativeEvent.which === 2) {
                e.preventDefault();
                e.stopPropagation();
                group.close(resource.uri);
              }
            }}
            onMouseDown={(e) => {
              if (e.nativeEvent.which === 1) {
                group.open(resource.uri, { focus: true });
              }
            }}
            data-uri={resource.uri.toString()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (ref) {
                ref.classList.add(styles.kt_on_drag_over);
              }
            }}
            onDragLeave={(e) => {
              if (ref) {
                ref.classList.remove(styles.kt_on_drag_over);
              }
            }}
            onDrop={(e) => {
              if (ref) {
                ref.classList.remove(styles.kt_on_drag_over);
              }
              if (onDrop) {
                onDrop(e, i, resource);
              }
            }}
            onDoubleClick={(e) => {
              group.pinPreviewed(resource.uri);
            }}
            ref={(el) => (ref = el)}
            onDragStart={(e) => {
              e.dataTransfer.setData('uri', resource.uri.toString());
              e.dataTransfer.setData('uri-source-group', group.name);
            }}
          >
            <div className={tabsLoadingMap[resource.uri.toString()] ? 'loading_indicator' : classnames(resource.icon)}>
              {' '}
            </div>
            <div>{resource.name}</div>
            {subname ? <div className={styles.subname}>{subname}</div> : null}
            {decoration.readOnly ? (
              <span className={classnames(getExternalIcon('lock'), styles.editor_readonly_icon)}></span>
            ) : null}
            <div className={styles.tab_right}>
              <div
                className={classnames({
                  [styles.kt_hidden]: !decoration.dirty,
                  [styles.dirty]: true,
                })}
              ></div>
              <div
                className={styles.close_tab}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  group.close(resource.uri);
                }}
              >
                <div className={classnames(getIcon('close'), styles.kt_editor_close_icon)} />
              </div>
            </div>
          </div>
        );
      })}
      {wrapMode && <EditorActions className={styles.kt_editor_wrap_mode_action} ref={editorActionRef} group={group} />}
    </div>
  );

  return (
    <div id={VIEW_CONTAINERS.EDITOR_TABS} className={styles.kt_editor_tabs}>
      <div
        className={styles.kt_editor_tabs_scroll_wrapper}
        ref={tabWrapperRef as any}
        onDragOver={handleWrapperDragOver}
        onDragLeave={handleWrapperDragLeave}
        onDrop={handleWrapperDrag}
        onDoubleClick={handleEmptyDBClick}
      >
        {!wrapMode ? (
          <Scrollbars
            tabBarMode
            forwardedRef={(el) => (el ? (tabContainer.current = el) : null)}
            className={styles.kt_editor_tabs_scroll}
          >
            {renderTabContent()}
          </Scrollbars>
        ) : (
          <div className={styles.kt_editor_wrap_container}>{renderTabContent()}</div>
        )}
      </div>
      {!wrapMode && <EditorActions ref={editorActionRef} group={group} />}
    </div>
  );
};

export interface IEditorActionsBaseProps {
  group: EditorGroup;
  className?: string;
}

export type IEditorActionsProps = IEditorActionsBaseProps & HTMLAttributes<HTMLDivElement>;

export const EditorActions = forwardRef<HTMLDivElement, IEditorActionsProps>(
  (props: IEditorActionsProps, ref: Ref<typeof EditorActions>) => {
    const { group, className } = props;

    const acquireArgs = useCallback(
      () =>
        (group.currentResource
          ? [
              group.currentResource.uri,
              group,
              group.currentOrPreviousFocusedEditor?.currentUri || group.currentEditor?.currentUri,
            ]
          : undefined) as [URI, IEditorGroup, MaybeNull<URI>] | undefined,
      [group],
    );

    const editorActionRegistry = useInjectable<IEditorActionRegistry>(IEditorActionRegistry);
    const editorService: WorkbenchEditorServiceImpl = useInjectable(WorkbenchEditorService);
    const menu = editorActionRegistry.getMenu(group);
    const [hasFocus, setHasFocus] = useState<boolean>(editorService.currentEditorGroup === group);
    const [args, setArgs] = useState<[URI, IEditorGroup, MaybeNull<URI>] | undefined>(acquireArgs());

    useEffect(() => {
      const disposableCollection = new DisposableCollection();
      disposableCollection.push(
        editorService.onDidCurrentEditorGroupChanged(() => {
          setHasFocus(editorService.currentEditorGroup === group);
        }),
      );
      disposableCollection.push(
        editorService.onActiveResourceChange(() => {
          setArgs(acquireArgs());
        }),
      );
      disposableCollection.push(
        group.onDidEditorGroupTabChanged(() => {
          setArgs(acquireArgs());
        }),
      );
      return () => {
        disposableCollection.dispose();
      };
    }, [group]);

    // 第三个参数是当前编辑器的URI（如果有）
    return (
      <div
        ref={ref}
        className={classnames(styles.editor_actions, className)}
        style={{ height: LAYOUT_VIEW_SIZE.EDITOR_TABS_HEIGHT }}
      >
        <InlineMenuBar<URI, IEditorGroup, MaybeNull<URI>>
          menus={menu}
          context={args as any}
          // 不 focus 的时候只展示 more 菜单
          regroup={(nav, more) => (hasFocus ? [nav, more] : [[], more])}
        />
      </div>
    );
  },
);

function preventNavigation(this: HTMLDivElement, e: WheelEvent) {
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
  }
}
