import * as React from 'react';
import { useInjectable, URI, DomListener, Disposable } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Path } from '@ali/ide-core-common/lib/path';
import Icon from '@ali/ide-core-browser/lib/components/icon';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

import * as styles from './navigation.module.less';
import { IResource, IEditorGroup } from '../common';
import { IBreadCrumbService, IBreadCrumbPart } from './types';
import { Injectable } from '@ali/common-di';
import { observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { Scroll, IScrollDelegate } from './component/scroll/scroll';
import * as classnames from 'classnames';

export const NavigationBar = observer(({ editorGroup }: { editorGroup: IEditorGroup }) => {

  const breadCrumbService = useInjectable(IBreadCrumbService) as IBreadCrumbService;

  if (editorGroup.resources.length === 0 || !editorGroup.currentResource) {
    return null;
  }

  let parts: IBreadCrumbPart[] | undefined;
  if (editorGroup.currentEditor) {
    parts = breadCrumbService.getBreadCrumbs(editorGroup.currentEditor.currentDocumentModel!.uri, editorGroup.currentEditor);
  } else {
    parts = breadCrumbService.getBreadCrumbs(editorGroup.currentResource.uri, editorGroup.currentEditor);
  }

  if (!parts) {
    return null;
  }
  return (parts.length === 0 ? null : <div className={styles.navigation_container}><div className={styles.navigation}>
    {
      parts.map((p, i) => {
        return <React.Fragment key={p.name}>
          {i > 0 && <Icon icon={'right'} size='small' /> }
          <NavigationItem part={p} />
        </React.Fragment>;
      })
    }
  </div></div>);
});

export const NavigationItem = ({part}: {part: IBreadCrumbPart}) => {

  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;
  const itemRef = React.useRef<HTMLSpanElement>();

  const onClick = part.getSiblings ? async () => {
          if (itemRef.current) {
            const { left, top, height} = itemRef.current.getBoundingClientRect();
            const siblings = await part.getSiblings!();
            viewService.showMenu(siblings.parts, left, top + height + 5, siblings.currentIndex);
          }
        } : undefined;

  return <span onClick={onClick} className={styles['navigation-part']} ref={itemRef as any}>
    <span className={part.icon || getIcon('smile')}></span>
    <span>{part.name}</span>
  </span>;
};

export const NavigationMenu = observer(({model}: {model: NavigationMenuModel}) => {
  let maxHeight = (window.innerHeight - model.y - 20);
  let top = model.y;
  const height = model.parts.length * 22;
  if (maxHeight < 100 && maxHeight < height) {
    maxHeight = 100;
    top = window.innerHeight - 20 - maxHeight;
  }

  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;

  const onSetScrollDelegate = (delegate: IScrollDelegate) => {
    delegate.scrollTo({
      top: 22 * model.initialIndex - Math.min(maxHeight, height) * 0.5,
      left: 0,
    });
  };

  return <div className={styles.navigation_menu} style={{
    left: model.x + 'px',
    top: top + 'px',
    maxHeight: maxHeight + 'px',
    height: height + 'px',
  }}>
    <Scroll className={styles.navigation_menu_items} delegate={onSetScrollDelegate}>
      {
        model.parts.map((p, i) => {
          let itemRef: HTMLDivElement | null;
          const clickToGetChild = p.getChildren ? async () => {
            if (itemRef) {
              const { left, top, width} = itemRef.getBoundingClientRect();
              let nextLeft = left + width + 5;
              if (window.innerWidth - nextLeft < 200 + 10) {
                // 放左边
                nextLeft = left - width - 5;
              }
              model.showSubMenu(await p.getChildren!(), nextLeft, top);
            }
          } : undefined;

          const clickToNavigate = p.onClick ? () => {
            p.onClick!();
            viewService.dispose();
          } : undefined;
          return  <div onClick={clickToNavigate || clickToGetChild} ref={(el) => itemRef = el} className={
            classnames({
              [styles.navigation_menu_item_current]: i === model.initialIndex,
            })
          }>
            <span className={p.icon || getIcon('smile')}></span>
            <span>{p.name}</span>
            {p.getChildren && <span className={styles.navigation_right} onClick={
              // 如果两个都存在，点右侧按钮为展开，点击名称为导航至
              (clickToNavigate && clickToGetChild) ? (e) => {
                e.stopPropagation();
                clickToGetChild();
              } : undefined
            }><Icon icon={'right'} size='small' /></span> }
          </div>;
        })
      }
    </Scroll>
    {
      model.subMenu && <NavigationMenu model={model.subMenu}/>
    }
  </div>;
});

export const NavigationMenuContainer = observer(() => {

  const viewService = useInjectable(NavigationBarViewService) as NavigationBarViewService;
  const menuRef = React.useRef<HTMLDivElement>();

  React.useEffect(() => {
    if (menuRef.current) {
      const disposer = new Disposable();
      disposer.addDispose(new DomListener(window, 'mouseup', () => {
        viewService.dispose();
      }));
      disposer.addDispose(new DomListener(menuRef.current, 'mouseup', (event) => {
        event.stopPropagation();
      }));
      return disposer.dispose.bind(disposer);
    }
  });

  if (!viewService.current) {
    return null;
  } else {
    return <div tabIndex={1} ref={menuRef as any}>
      <NavigationMenu model={viewService.current} />
    </div>;
  }
});

@Injectable()
export class NavigationBarViewService {

  @observable.ref current: NavigationMenuModel | undefined;

  showMenu(parts: IBreadCrumbPart[], x, y, currentIndex) {
    this.current = new NavigationMenuModel(parts, x, y, currentIndex);
  }

  dispose() {
    if (this.current) {
      this.current.dispose();
    }
    this.current = undefined;
  }
}

export class NavigationMenuModel {

  @observable.ref subMenu?: NavigationMenuModel;

  constructor(public readonly parts: IBreadCrumbPart[], public readonly x, public readonly y, public readonly initialIndex: number = -1) {

  }

  showSubMenu(parts: IBreadCrumbPart[], x, y) {
    this.subMenu = new NavigationMenuModel(parts, x, y);
  }

  dispose() {
    if (this.subMenu) {
      this.subMenu.dispose();
    }
    this.subMenu = undefined;
  }

}
