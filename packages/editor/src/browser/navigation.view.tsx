import cls from 'classnames';
import { action, makeObservable, observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { memo, useCallback, useEffect, useRef } from 'react';

import { Injectable } from '@opensumi/di';
import { Icon, Scrollbars } from '@opensumi/ide-components';
import { Disposable, DomListener, getIcon, useInjectable, useUpdateOnEvent } from '@opensumi/ide-core-browser';
import { IDesignStyleService } from '@opensumi/ide-core-browser/lib/design';

import { BreadCrumbsMenuService } from './menu/breadcrumbs.menus';
import styles from './navigation.module.less';
import { IBreadCrumbPart, IBreadCrumbService } from './types';
import { useUpdateOnGroupTabChange } from './view/react-hook';
import { EditorGroup } from './workbench-editor.service';

export const NavigationBar = ({ editorGroup }: { editorGroup: EditorGroup }) => {
  const breadCrumbService = useInjectable<IBreadCrumbService>(IBreadCrumbService);
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);

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
      className={designService.getStyles('navigation_container', styles.navigation_container)}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {parts.map((p, i) => (
        <React.Fragment key={i + '-crumb:' + p.name}>
          {i > 0 && (
            <Icon
              icon={'right'}
              size='small'
              className={designService.getStyles('navigation_icon', styles.navigation_icon)}
            />
          )}
          <NavigationItem part={p} editorGroup={editorGroup} />
        </React.Fragment>
      ))}
    </div>
  );
};
export const NavigationItem = memo(({ part, editorGroup }: { part: IBreadCrumbPart; editorGroup: EditorGroup }) => {
  const viewService = useInjectable<NavigationBarViewService>(NavigationBarViewService);
  const breadcrumbsMenuService = useInjectable<BreadCrumbsMenuService>(BreadCrumbsMenuService);
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);
  const itemRef = useRef<HTMLSpanElement>();

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
      className={designService.getStyles('navigation-part', styles['navigation-part'])}
      ref={itemRef as any}
    >
      {part.icon && <span className={part.icon}></span>}
      <span>{part.name}</span>
    </span>
  );
});

export const NavigationMenu = observer(({ model }: { model: NavigationMenuModel }) => {
  let maxHeight = window.innerHeight - model.y - 20;
  let top = model.y;
  const height = model.parts.length * 22;
  if (maxHeight < 100 && maxHeight < height) {
    maxHeight = 100;
    top = window.innerHeight - 20 - maxHeight;
  }

  const scrollerContainer = useRef<HTMLDivElement | null>();

  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;
  const designService = useInjectable<IDesignStyleService>(IDesignStyleService);

  const scrollToCurrent = useCallback(() => {
    if (scrollerContainer.current) {
      try {
        const current = scrollerContainer.current.querySelector(`.${styles.navigation_menu_item_current}`);
        if (current) {
          current.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      } catch (e) {
        // noop
      }
    }
  }, [scrollerContainer.current]);

  return (
    <div
      className={designService.getStyles('navigation_menu', styles.navigation_menu)}
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
              className={cls(designService.getStyles('navigation_menu_item', styles.navigation_menu_item), {
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
      {model.subMenu && <NavigationMenu model={model.subMenu} />}
    </div>
  );
});

export const NavigationMenuContainer = observer(() => {
  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;
  const menuRef = useRef<HTMLDivElement>();

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

  if (!viewService.current) {
    return null;
  } else {
    return (
      <div tabIndex={1} ref={menuRef as any}>
        <NavigationMenu model={viewService.current} />
      </div>
    );
  }
});

@Injectable()
export class NavigationBarViewService {
  @observable.ref current: NavigationMenuModel | null = null;
  @observable.ref editorGroup: EditorGroup | null = null;

  constructor() {
    makeObservable(this);
  }

  @action
  showMenu(parts: IBreadCrumbPart[], x, y, currentIndex, uri, editorGroup) {
    this.current = new NavigationMenuModel(parts, x, y, currentIndex, uri);
    this.editorGroup = editorGroup;
  }

  @action
  dispose() {
    if (this.current) {
      this.current.dispose();
    }
    this.current = null;
  }
}

export class NavigationMenuModel {
  @observable.ref subMenu: NavigationMenuModel | null = null;

  constructor(
    public readonly parts: IBreadCrumbPart[],
    public readonly x,
    public readonly y,
    public readonly initialIndex: number = -1,
    public readonly uri,
  ) {
    makeObservable(this);
  }

  @action
  showSubMenu(parts: IBreadCrumbPart[], x, y, uri) {
    this.subMenu = new NavigationMenuModel(parts, x, y, -1, uri);
  }

  @action
  dispose() {
    if (this.subMenu) {
      this.subMenu.dispose();
    }
    this.subMenu = null;
  }
}
