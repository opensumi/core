import cls from 'classnames';
import React, { ReactNode, useCallback, useMemo } from 'react';

import { Injectable } from '@opensumi/di';
import { Popover } from '@opensumi/ide-core-browser/lib/components';
import { uuid } from '@opensumi/ide-core-common';
import { EditorTabService } from '@opensumi/ide-editor/lib/browser/editor.tab.service';

import styles from './override.module.less';

const EditorTabCloseComponent = (props) => {
  const { children } = props;
  const [display, setDisplay] = React.useState(false);

  const uid = useMemo(() => 'editor-tab-close-' + uuid(6), []);

  const handleClick = useCallback(() => {
    setDisplay(false);
  }, []);

  return (
    <Popover id={uid} title='关闭' onClickAction={handleClick} display={display}>
      {children}
    </Popover>
  );
};

@Injectable()
export class AiEditorTabService extends EditorTabService {
  override renderEditorTab(component: ReactNode, isCurrent: boolean): ReactNode {
    return (
      <div
        className={cls({
          [styles.ai_editor_tab_block_container]: true,
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
