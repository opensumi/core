import { Injectable } from '@opensumi/di';
import { WithEventBus } from '@opensumi/ide-core-browser';
import { IEditorTabService } from './types';
import { ReactNode } from 'react';

@Injectable()
export class EditorTabService extends WithEventBus implements IEditorTabService {
  renderEditorTab(component: ReactNode, isCurrent: boolean): ReactNode {
    return component;
  }
}
