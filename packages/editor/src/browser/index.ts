import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService, ResourceService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable, Provider } from '@ali/common-di';
import { EditorCommandContribution } from './editor.contribution';
import { ResourceServiceImpl } from './resource.service';
import { EditorComponentRegistry } from './types';
import { EditorComponentRegistryImpl } from './component';

@Injectable()
export class EditorModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: WorkbenchEditorService,
      useClass: WorkbenchEditorServiceImpl,
    },
    {
      token: ResourceService,
      useClass: ResourceServiceImpl,
    },
    {
      token: EditorComponentRegistry,
      useClass: EditorComponentRegistryImpl,
    },
    EditorCommandContribution,
  ];
  slotMap = new Map([
    [
      SlotLocation.topPanel, EditorView,
    ],
  ]);

}
