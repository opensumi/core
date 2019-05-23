import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { CommandContribution, ConstructorOf } from '@ali/ide-core-common';
import { EditorView } from './editor.view';
import { EditorCollectionService, WorkbenchEditorService } from '../common';
import { EditorCollectionServiceImpl } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { Injectable } from '@ali/common-di';
import { EditorCommandContribution } from './editor.contribution';

@Injectable()
export class EditorModule extends BrowserModule {
  providers = [
    {
      token: EditorCollectionService,
      useClass: EditorCollectionServiceImpl,
    },
    {
      token: WorkbenchEditorService,
      useClass: WorkbenchEditorServiceImpl,
    },
  ];
  slotMap = new Map([
    [
      SlotLocation.topPanel, EditorView,
    ],
  ]);

  contributionsCls: Array<ConstructorOf<CommandContribution>> = [
    EditorCommandContribution,
  ];

}
