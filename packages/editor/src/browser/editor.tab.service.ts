import { ReactNode } from 'react';

import { Injectable } from '@opensumi/di';
import { WithEventBus } from '@opensumi/ide-core-browser';

import { IEditorTabService } from './types';

@Injectable()
export class EditorTabService extends WithEventBus implements IEditorTabService {
  renderEditorTab(component: ReactNode, isCurrent: boolean): ReactNode {
    return component;
  }
  renderTabCloseComponent(component: ReactNode): ReactNode {
    return component;
  }
}
