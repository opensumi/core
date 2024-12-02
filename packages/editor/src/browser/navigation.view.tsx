import cls from 'classnames';
import React, { memo, useCallback, useEffect, useRef } from 'react';

import { Injectable } from '@opensumi/di';
import { Icon, Scrollbars } from '@opensumi/ide-components';
import {
  Disposable,
  DomListener,
  fastdom,
  getIcon,
  useAutorun,
  useDesignStyles,
  useInjectable,
  useUpdateOnEvent,
} from '@opensumi/ide-core-browser';
import { observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

import { BreadCrumbsMenuService } from './menu/breadcrumbs.menus';
import styles from './navigation.module.less';
import { IBreadCrumbPart, IBreadCrumbService } from './types';
import { useUpdateOnGroupTabChange } from './view/react-hook';
import { EditorGroup } from './workbench-editor.service';

export const NavigationBar = ({ editorGroup }: { editorGroup: EditorGroup }) => {
  const breadCrumbService = useInjectable<IBreadCrumbService>(IBreadCrumbService);
  const styles_navigation_container = useDesignStyles(styles.navigation_container, 'navigation_container');
  const styles_navigation_icon = useDesignStyles(styles.navigation_icon, 'navigation_icon');

  useUpdateOnGroupTabChange(editorGroup);

  useUpdateOnEvent(breadCrumbService.onDidUpdateBreadCrumbResults, [], (e) => {
    const editor =
      editorGroup.currentEditor && editorGroup.currentEditor.currentDocumentModel ? editorGroup.currentEditor : null;
    const uri =
      editorGroup.currentEditor && editorGroup.currentEditor.currentDocumentModel
        ? editorGroup.currentEditor.currentDocumentModel!.uri
        : editorGroup.currentResource?.uri;
    return !!uri && e.editor === editor && e.uri.isEqual(uri);
  });

  if (editorGroup.resources.length === 0 || !editorGroup.currentResource) {
    return null;
  }

  let parts: IBreadCrumbPart[] | undefined;
  if (editorGroup.currentEditor && editorGroup.currentEditor.currentDocumentModel) {
    parts = breadCrumbService.getBreadCrumbs(
      editorGroup.currentEditor.currentDocumentModel!.uri,
      editorGroup.currentEditor,
    );
  } else {
    parts = breadCrumbService.getBreadCrumbs(editorGroup.currentResource.uri, null);
  }

  if (!parts) {
    return null;
  }
  return parts.length === 0 ? null : (
    <div
      className={cls('kt-navigation-container', styles_navigation_container)}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {parts.map((p, i) => (
        <React.Fragment key={i + '-crumb:' + p.name}>
          {i > 0 && <Icon icon={'right'} size='small' className={styles_navigation_icon} />}
          <NavigationItem part={p} editorGroup={editorGroup} />
        </React.Fragment>
      ))}
    </div>
  );
};
export const NavigationItem = memo(({ part, editorGroup }: { part: IBreadCrumbPart; editorGroup: EditorGroup }) => {
  const viewService = useInjectable<NavigationBarViewService>(NavigationBarViewService);
  const breadcrumbsMenuService = useInjectable<BreadCrumbsMenuService>(BreadCrumbsMenuService);
  const itemRef = useRef<HTMLSpanElement>();
  const styles_navigation_part = useDesignStyles(styles['navigation-part'], 'navigation-part');

  const onClick = useCallback(async () => {
    if (part.getSiblings && itemRef.current) {
      const { left, top, height } = itemRef.current.getBoundingClientRect();
      const siblings = await part.getSiblings!();
      let leftPos = left;
      if (window.innerWidth - leftPos < 200 + 10) {
        // 放左边
        leftPos = window.innerWidth - 200 - 5;
      }
      viewService.showMenu(siblings.parts, leftPos, top + height + 5, siblings.currentIndex, part.uri, editorGroup);
    }
  }, [itemRef.current, part]);

  return (
    <span
      onClick={onClick}
      onContextMenu={(event) => {
        if (!part.isSymbol && part.uri) {
          breadcrumbsMenuService.show(event.nativeEvent.x, event.nativeEvent.y, editorGroup, part.uri);
        }
        event.preventDefault();
      }}
      className={styles_navigation_part}
      ref={itemRef as any}
    >
      {part.icon && <span className={part.icon}></span>}
      <span>{part.name}</span>
    </span>
  );
});

export const NavigationMenu = ({ model }: { model: NavigationMenuModel }) => {
  let maxHeight = window.innerHeight - model.y - 20;
  let top = model.y;
  const height = model.parts.length * 22;
  if (maxHeight < 100 && maxHeight < height) {
    maxHeight = 100;
    top = window.innerHeight - 20 - maxHeight;
  }

  const scrollerContainer = useRef<HTMLDivElement | null>();
  const styles_navigation_menu = useDesignStyles(styles.navigation_menu, 'navigation_menu');
  const styles_navigation_menu_item = useDesignStyles(styles.navigation_menu_item, 'navigation_menu_item');
  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;

  const subMenu = useAutorun(model.subMenu);

  const scrollToCurrent = useCallback(() => {
    fastdom.measure(() => {
      try {
        if (scrollerContainer.current) {
          const current = scrollerContainer.current.querySelector(`.${styles.navigation_menu_item_current}`);
          if (current) {
            current.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }
      } catch (e) {
        // noop
      }
    });
  }, [scrollerContainer.current]);

  return (
    <div
      className={styles_navigation_menu}
      style={{
        left: model.x + 'px',
        top: top + 'px',
        maxHeight: maxHeight + 'px',
        height: height + 'px',
      }}
    >
      <Scrollbars
        className={styles.navigation_menu_items}
        universal={true}
        forwardedRef={(el) => {
          scrollerContainer.current = el;
          scrollToCurrent();
        }}
      >
        {model.parts.map((p, i) => {
          let itemRef: HTMLDivElement | null;
          const clickToGetChild = p.getChildren
            ? async () => {
                if (itemRef) {
                  const { left, top, width } = itemRef.getBoundingClientRect();
                  let nextLeft = left + width + 5;
                  if (window.innerWidth - nextLeft < 200 + 10) {
                    // 放左边
                    nextLeft = left - width - 5;
                  }
                  const parts = await p.getChildren!();
                  model.showSubMenu(parts, nextLeft, top, model);
                }
              }
            : undefined;

          const clickToNavigate = p.onClick
            ? () => {
                p.onClick!();
                viewService.dispose();
              }
            : undefined;
          return (
            <div
              onClick={clickToNavigate || clickToGetChild}
              ref={(el) => (itemRef = el)}
              className={cls(styles_navigation_menu_item, {
                [styles.navigation_menu_item_current]: i === model.initialIndex,
              })}
              key={'menu-' + p.name}
            >
              <span className={p.icon || getIcon('smile')}></span>
              <span className={styles.navigation_menu_item_label}>{p.name}</span>
              {p.getChildren && (
                <span
                  className={styles.navigation_right}
                  onClick={
                    // 如果两个都存在，点右侧按钮为展开，点击名称为导航至
                    clickToNavigate && clickToGetChild
                      ? (e) => {
                          e.stopPropagation();
                          clickToGetChild();
                        }
                      : undefined
                  }
                >
                  <Icon icon={'right'} size='small' />
                </span>
              )}
            </div>
          );
        })}
      </Scrollbars>
      {subMenu && <NavigationMenu model={subMenu} />}
    </div>
  );
};

export const NavigationMenuContainer = () => {
  const menuRef = useRef<HTMLDivElement>();
  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;
  const current = useAutorun(viewService.current);

  useEffect(() => {
    if (menuRef.current) {
      const disposer = new Disposable();
      disposer.addDispose(
        new DomListener(window, 'mouseup', () => {
          viewService.dispose();
        }),
      );
      disposer.addDispose(
        new DomListener(menuRef.current, 'mouseup', (event) => {
          event.stopPropagation();
        }),
      );
      return disposer.dispose.bind(disposer);
    }
  });

  if (!current) {
    return null;
  } else {
    return (
      <div tabIndex={1} ref={menuRef as any}>
        <NavigationMenu model={current} />
      </div>
    );
  }
};

@Injectable()
export class NavigationBarViewService {
  readonly current = observableValue<NavigationMenuModel | null>(this, null);

  showMenu(parts: IBreadCrumbPart[], x, y, currentIndex, uri, editorGroup) {
    transaction((tx) => {
      this.current.set(new NavigationMenuModel(parts, x, y, currentIndex, uri), tx);
    });
  }

  dispose() {
    transaction((tx) => {
      const current = this.current.get();
      current?.dispose();

      this.current.set(null, tx);
    });
  }
}

export class NavigationMenuModel {
  readonly subMenu = observableValue<NavigationMenuModel | null>(this, null);

  constructor(
    public readonly parts: IBreadCrumbPart[],
    public readonly x,
    public readonly y,
    public readonly initialIndex: number = -1,
    public readonly uri,
  ) {}

  showSubMenu(parts: IBreadCrumbPart[], x, y, uri) {
    transaction((tx) => {
      this.subMenu.set(new NavigationMenuModel(parts, x, y, -1, uri), tx);
    });
  }

  dispose() {
    transaction((tx) => {
      const subMenu = this.subMenu.get();
      subMenu?.dispose();

      this.subMenu.set(null, tx);
    });
  }
}
