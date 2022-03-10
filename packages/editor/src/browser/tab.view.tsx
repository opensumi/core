import classnames from 'classnames';
import React, { useEffect, useState, useCallback, useRef, useContext, useMemo, forwardRef } from 'react';

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
} from '@opensumi/ide-core-browser';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { useInjectable, useUpdateOnEventBusEvent } from '@opensumi/ide-core-browser/lib/react-hooks';

import { IResource, ResourceService, IEditorGroup, WorkbenchEditorService, ResourceDidUpdateEvent } from '../common';

import { Scroll } from './component/scroll/scroll';
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
  const contentRef = useRef<HTMLDivElement>();
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
    [group.resources.length],
    (uri) => group.resources.findIndex((r) => r.uri.isEqual(uri)) !== -1,
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
    (e: React.DragEvent, index: number, target?: IResource) => {
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
            scrollToTabEl(tabContainer.current, currentTab as HTMLDivElement);
          }
        } catch (e) {
          // noop
        }
      }
    }
  }, [group]);

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

  const layoutLastInRow = React.useCallback(() => {
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

  const renderTabContent = () => (
    <div
      className={styles.kt_editor_tabs_content}
      ref={contentRef as any}
      onDragLeave={(e) => {
        if (contentRef.current) {
          contentRef.current.classList.remove(styles.kt_on_drag_over);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (contentRef.current) {
          contentRef.current.classList.add(styles.kt_on_drag_over);
        }
      }}
      onDrop={(e) => {
        if (contentRef.current) {
          contentRef.current.classList.remove(styles.kt_on_drag_over);
        }
        if (onDrop) {
          onDrop(e, -1);
        }
      }}
      onDoubleClick={(e) => {
        // 只处理 tab 组空余的地方
        if (e.target === e.currentTarget) {
          editorService.createUntitledResource();
        }
      }}
    >
      {group.resources.map((resource, i) => {
        let ref: HTMLDivElement | null;
        const decoration = resourceService.getResourceDecoration(resource.uri);
        const subname = resourceService.getResourceSubname(resource, group.resources);
        return (
          <div
            draggable={true}
            className={classnames({
              [styles.kt_editor_tab]: true,
              [styles.last_in_row]: tabMap.get(i),
              [styles.kt_editor_tab_current]: group.currentResource === resource,
              [styles.kt_editor_tab_preview]: group.previewURI && group.previewURI.isEqual(resource.uri),
            })}
            style={wrapMode && i === group.resources.length - 1 ? { marginRight: lastMarginRight } : {}}
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
                group.open(resource.uri);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (ref) {
                ref.classList.add(styles.kt_on_drag_over);
              }
            }}
            data-uri={resource.uri.toString()}
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
    <div className={styles.kt_editor_tabs}>
      <div className={styles.kt_editor_tabs_scroll_wrapper}>
        {!wrapMode ? (
          <Scroll ref={(el) => (el ? (tabContainer.current = el.ref) : null)} className={styles.kt_editor_tabs_scroll}>
            {renderTabContent()}
          </Scroll>
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

export type IEditorActionsProps = IEditorActionsBaseProps & React.HTMLAttributes<HTMLDivElement>;

export const EditorActions = forwardRef<HTMLDivElement, IEditorActionsProps>(
  (props: IEditorActionsProps, ref: React.Ref<typeof EditorActions>) => {
    const { group, className } = props;
    const editorActionRegistry = useInjectable<IEditorActionRegistry>(IEditorActionRegistry);
    const editorService: WorkbenchEditorServiceImpl = useInjectable(WorkbenchEditorService);
    const menu = editorActionRegistry.getMenu(group);
    const [hasFocus, setHasFocus] = useState<boolean>(editorService.currentEditorGroup === group);

    useEffect(() => {
      const disposableCollection = new DisposableCollection();
      disposableCollection.push(
        editorService.onDidCurrentEditorGroupChanged(() => {
          setHasFocus(editorService.currentEditorGroup === group);
        }),
      );
      return () => {
        disposableCollection.dispose();
      };
    }, []);

    const args: [URI, IEditorGroup, MaybeNull<URI>] | undefined = group.currentResource
      ? [group.currentResource.uri, group, group.currentOrPreviousFocusedEditor?.currentUri]
      : undefined;
    // 第三个参数是当前编辑器的URI（如果有）
    return (
      <div ref={ref} className={classnames(styles.editor_actions, className)}>
        <InlineActionBar<URI, IEditorGroup, MaybeNull<URI>>
          menus={menu}
          context={args as any /* 这个推断过不去.. */}
          // 不 focus 的时候只展示 more 菜单
          regroup={(nav, more) => (hasFocus ? [nav, more] : [[], more])}
          debounce={{ delay: 100, maxWait: 300 }}
        />
      </div>
    );
  },
);

/**
 * 获取tab DOM在可视范围的位置
 * @param {HTMLElement} container
 * @param {HTMLElement} el
 * @returns {number} -1左边或骑跨，0可见，1右边
 */
function getTabDOMPosition(container: HTMLElement, el: HTMLElement): number {
  const left = container.scrollLeft;
  const right = left + container.offsetWidth;
  const elLeft = el.offsetLeft;
  const elRight = el.offsetWidth + elLeft;
  if (el.offsetWidth > container.offsetWidth) {
    return -1;
  }
  if (left <= elLeft) {
    if (right >= elRight) {
      return 0;
    } else {
      return 1;
    }
  } else {
    return -1;
  }
}

function scrollToTabEl(container: HTMLElement, el: HTMLElement) {
  const position = getTabDOMPosition(container, el);
  if (position < 0) {
    container.scrollLeft = el.offsetLeft;
  } else if (position > 0) {
    container.scrollLeft = el.offsetLeft + el.offsetWidth - container.offsetWidth;
  }
}

function preventNavigation(this: HTMLDivElement, e: WheelEvent) {
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
  }
}
