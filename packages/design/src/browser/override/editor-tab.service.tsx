import cls from 'classnames';
import React, { ReactNode, useCallback, useMemo } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { Popover, PopoverPosition } from '@opensumi/ide-core-browser/lib/components';
import { LayoutViewSizeConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { formatLocalize, isMacintosh, uuid } from '@opensumi/ide-core-common';
import { EditorTabService } from '@opensumi/ide-editor/lib/browser/editor.tab.service';

import styles from '../style/design.module.less';

const EditorTabCloseComponent = (props) => {
  const { children } = props;
  const [display, setDisplay] = React.useState(false);

  const uid = useMemo(() => 'editor-tab-close-' + uuid(6), []);

  const handleClick = useCallback(() => {
    setDisplay(false);
  }, []);

  const title = useMemo(() => formatLocalize('editor.closeTab.title', isMacintosh ? '⌘W' : 'Ctrl+W'), []);

  return (
    <Popover
      delay={1000}
      position={PopoverPosition.bottom}
      id={uid}
      title={title}
      onClickAction={handleClick}
      display={display}
    >
      <span title=''>{children}</span>
    </Popover>
  );
};

@Injectable()
export class DesignEditorTabService extends EditorTabService {
  @Autowired(LayoutViewSizeConfig)
  private layoutViewSize: LayoutViewSizeConfig;

  override renderEditorTab(component: ReactNode, isCurrent: boolean): ReactNode {
    return (
      <div
        className={cls({
          [styles['design-editor_tab_block_container']]: true,
          [styles.active]: isCurrent,
        })}
        style={{
          height: this.layoutViewSize.editorTabsHeight,
        }}
      >
        {component}
      </div>
    );
  }

  override renderTabCloseComponent(component: ReactNode): ReactNode {
    return <EditorTabCloseComponent>{component}</EditorTabCloseComponent>;
  }
}
