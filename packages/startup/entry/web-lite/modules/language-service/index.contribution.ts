import { Autowired } from '@ide-framework/common-di';
import { Disposable, Domain, URI } from '@ide-framework/ide-core-common';
import { ClientAppContribution } from '@ide-framework/ide-core-browser';
import { Position } from '@ide-framework/ide-kaitian-extension/lib/common/vscode/ext-types';
import type vscode from 'vscode';
import { IWorkspaceService } from '@ide-framework/ide-workspace';

import { IMetaService } from '../../services/meta-service/base';
import { ILsifService } from '../../services/lsif-service/base';

import { SimpleLanguageService } from './simple';

@Domain(ClientAppContribution)
export class LanguageServiceContribution extends Disposable implements ClientAppContribution {
  @Autowired(SimpleLanguageService)
  private readonly simpleLanguageService: SimpleLanguageService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(ILsifService)
  private readonly lsifService: ILsifService;

  get workspaceUri() {
    return new URI(this.workspaceService.workspace!.uri);
  }

  onStart() {
    // lsif registration
    this.addDispose(
      this.simpleLanguageService.registerHoverProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideHover: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const payload = {
            repository: this.metaService.repo!,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString()!,
            line: position.line,
            character: position.character,
          };
          return await this.lsifService.fetchLsifHover(payload);
        },
      }),
    );

    this.addDispose(
      this.simpleLanguageService.registerDefinitionProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideDefinition: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const payload = {
            repository: this.metaService.repo!,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString()!,
            line: position.line,
            character: position.character,
          };
          return await this.lsifService.fetchLsifDefinition(payload);
        },
      }),
    );

    this.addDispose(
      this.simpleLanguageService.registerReferenceProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideReferences: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const payload = {
            repository: this.metaService.repo!,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString()!,
            line: position.line,
            character: position.character,
          };
          return await this.lsifService.fetchLsifReferences(payload);
        },
      }),
    );
  }
}
