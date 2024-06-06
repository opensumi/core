import cls from 'classnames';
import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { EditorTabService } from '@opensumi/ide-editor/lib/browser/editor.tab.service';

import styles from '../style/design.module.less';

const EditorTabCloseComponent = (props) => {
  const { children } = props;
  return children;
};

@Injectable()
export class DesignEditorTabService extends EditorTabService {
  override renderEditorTab(component: ReactNode, isCurrent: boolean): ReactNode {
    return (
      <div
        className={cls({
          [styles['design-editor_tab_block_container']]: true,
          [styles.active]: isCurrent,
        })}
      >
        {component}
      </div>
    );
  }

  override renderTabCloseComponent(component: ReactNode): ReactNode {
    return <EditorTabCloseComponent>{component}</EditorTabCloseComponent>;
  }
}
