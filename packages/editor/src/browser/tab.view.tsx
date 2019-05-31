
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { IResource } from '../common';
import * as styles from './editor.module.less';
import classnames from 'classnames';
import { MaybeNull } from '@ali/ide-core-browser';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components';
export interface ITabsProps {
  resources: IResource[];
  currentResource: MaybeNull<IResource>;
  onActivate: (resource: IResource) => void;
  onClose: (resource: IResource) => void;
  onDragStart?: (event: React.DragEvent, resource: IResource) => void;
  onDrop?: (event: React.DragEvent, targetResource?: IResource) => void; // targetResource为undefined表示扔在空白处
}

export const Tabs = observer(({resources, currentResource, onActivate, onClose, onDragStart, onDrop}: ITabsProps) => {
  return <div className={styles.kt_editor_tabs}><PerfectScrollbar style={ {width: '100%', height: '35px'} } options={{suppressScrollY: true}}>
    <div className={styles.kt_editor_tabs_content}>
    {resources.map((resource) => {
      let ref: HTMLDivElement | null;
      return <div draggable={true} className={classnames({
                    [styles.kt_editor_tab]: true,
                    [styles.kt_editor_tab_current]: currentResource === resource,
                  })}
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
                  }}
                  ref={(el) => ref = el} >
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
  </PerfectScrollbar></div>;
});
