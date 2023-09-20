import cls from 'classnames';
import React, { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { EditorTabService } from '@opensumi/ide-editor/lib/browser/editor.tab.service';

import * as styles from './override.module.less';

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
}
