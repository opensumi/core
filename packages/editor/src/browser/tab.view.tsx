
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IResource, ResourceService } from '../common';
import * as styles from './editor.module.less';
import classnames from 'classnames';
import { MaybeNull, IEventBus, getSlotLocation, ConfigContext, ResizeEvent } from '@ali/ide-core-browser';
// TODO editor 不应该依赖main-layout
import { Scroll } from './component/scroll/scroll';
import { GridResizeEvent } from './types';
import { getIcon } from '@ali/ide-theme/lib/browser';

const pkgName = require('../../package.json').name;

export interface ITabsProps {
  resources: IResource[];
  currentResource: MaybeNull<IResource>;
  onActivate: (resource: IResource) => void;
  onClose: (resource: IResource) => void;
  onDragStart?: (event: React.DragEvent, resource: IResource) => void;
  onContextMenu: (event: React.MouseEvent, resource: IResource) => void;
  onDrop?: (event: React.DragEvent, targetResource?: IResource) => void; // targetResource为undefined表示扔在空白处
  gridId: () => string;
}

export const Tabs = observer(({resources, currentResource, onActivate, onClose, onDragStart, onDrop, onContextMenu, gridId}: ITabsProps) => {
  const currentTabRef = React.useRef<HTMLElement>();
  const tabContainer = React.useRef<HTMLDivElement | null>();
  const resourceService = useInjectable(ResourceService) as ResourceService;
  const eventBus = useInjectable(IEventBus) as IEventBus;
  const configContext = React.useContext(ConfigContext);

  function scrollToCurrent() {
    if (currentTabRef.current && tabContainer.current) {
      scrollToTabEl(tabContainer.current, currentTabRef.current);
    }
  }

  React.useEffect(() => {
    if (tabContainer.current) {
      tabContainer.current.addEventListener('mousewheel', preventNavigation as any);
    }
    scrollToCurrent();
    const disposers = [
        eventBus.on(ResizeEvent, (event) => {
          if (event.payload.slotLocation === getSlotLocation(pkgName, configContext.layoutConfig)) {
            scrollToCurrent();
          }
        }),
        eventBus.on(GridResizeEvent, (event) => {
        if (event.payload.gridId === gridId()) {
          scrollToCurrent();
        }
      }),
    ];
    return () => {
      disposers.forEach((disposer) => {
        disposer.dispose();
      });
      tabContainer.current!.removeEventListener('mousewheel', preventNavigation as any);
    };
  });

  return <div className={styles.kt_editor_tabs}>
    {/* <PerfectScrollbar style={ {width: '100%', height: '35px'} } options={{suppressScrollY: true}} containerRef={(el) => tabContainer.current = el}> */}
    <Scroll ref={(el) => el ? tabContainer.current = el.ref : null } className={styles.kt_editor_tabs_scroll}>
    <div className={styles.kt_editor_tabs_content}>
    {resources.map((resource) => {
      let ref: HTMLDivElement | null;
      const decoration = resourceService.getResourceDecoration(resource.uri);
      const subname = resourceService.getResourceSubname(resource, resources);
      return <div draggable={true} className={classnames({
                    [styles.kt_editor_tab]: true,
                    [styles.kt_editor_tab_current]: currentResource === resource,
                  })}
                  onContextMenu={(e) => {
                    onContextMenu(e, resource);
                  }}
                  ref={(el) => {
                    if (el) {
                      ref = el;
                      if ((currentResource === resource)) {
                        currentTabRef.current = el;
                      }
                    }
                  }}
                  key={resource.uri.toString()}
                  onClick={(e) => onActivate(resource)}
                  onDragOver={(e) => {
                    e.preventDefault();
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
                      onDrop(e, resource);
                    }
                  }}
                  onDragStart={(e) => {
                    if (onDragStart) {
                      onDragStart(e, resource);
                    }
                  }}>
        <div className={resource.icon}> </div>
        <div>{resource.name}</div>
        { subname ? <div className={styles.subname}>{subname}</div> : null}
        <div className={styles.tab_right}>
          <div className={
            classnames({
              [styles.kt_hidden]: !decoration.dirty,
              [styles.dirty]: true,
            })
          }></div>
          <div className={styles.close_tab} onClick={(e) => {
            e.stopPropagation();
            onClose(resource);
          }}>
            <div className={getIcon('close')} />
          </div>
        </div>
      </div>;
    })}
  </div>
  </Scroll></div>;
});

/**
   * 获取tab DOM在可视范围的位置
   * @param {HTMLElement} container
   * @param {HTMLElement} el
   * @returns {number} -1左边或骑跨，0可见，1右边
   */
function getTabDOMPosition(container: HTMLElement , el: HTMLElement): number {
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
