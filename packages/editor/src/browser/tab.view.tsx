
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IResource } from '../common';
import * as styles from './editor.module.less';
import classnames from 'classnames';
import { MaybeNull, IEventBus } from '@ali/ide-core-browser';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { Scroll } from './component/scroll/scroll';
export interface ITabsProps {
  resources: IResource[];
  currentResource: MaybeNull<IResource>;
  onActivate: (resource: IResource) => void;
  onClose: (resource: IResource) => void;
  onDragStart?: (event: React.DragEvent, resource: IResource) => void;
  onDrop?: (event: React.DragEvent, targetResource?: IResource) => void; // targetResource为undefined表示扔在空白处
}

export const Tabs = observer(({resources, currentResource, onActivate, onClose, onDragStart, onDrop}: ITabsProps) => {
  const currentTabRef = React.useRef<HTMLElement>();
  const tabContainer = React.useRef<HTMLDivElement | null>();

  const eventBus = useInjectable(IEventBus) as IEventBus;

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
    const disposer = eventBus.on(ResizeEvent, (event) => {
      if (event.payload.slotLocation === SlotLocation.topPanel) {
        // TODO 监听逻辑可能需要修改
        scrollToCurrent();
      }
    });
    return () => {
      disposer.dispose();
      tabContainer.current!.removeEventListener('mousewheel', preventNavigation as any);
    };
  });

  return <div className={styles.kt_editor_tabs}>
    {/* <PerfectScrollbar style={ {width: '100%', height: '35px'} } options={{suppressScrollY: true}} containerRef={(el) => tabContainer.current = el}> */}
    <Scroll ref={(el) => el ? tabContainer.current = el.ref : null }>
    <div className={styles.kt_editor_tabs_content}>
    {resources.map((resource) => {
      let ref: HTMLDivElement | null;
      return <div draggable={true} className={classnames({
                    [styles.kt_editor_tab]: true,
                    [styles.kt_editor_tab_current]: currentResource === resource,
                  })}
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
        <span className={resource.icon}> </span>
        <span>{resource.name}</span>
        <span className={styles.close_tab} onClick={(e) => {
          e.stopPropagation();
          onClose(resource);
        }}>
          X {/* TODO 添加icon  */}
        </span>
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
  console.log(e);
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
  }
}
