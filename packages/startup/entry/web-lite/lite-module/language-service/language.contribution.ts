import type * as vscode from 'vscode';

import { Autowired } from '@opensumi/di';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import { Disposable, Domain, URI } from '@opensumi/ide-core-common';
import { Position } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { ILsifService } from './lsif-service/base';
import { SimpleLanguageService } from './simple.service';

@Domain(ClientAppContribution)
export class LanguageServiceContribution extends Disposable implements ClientAppContribution {
  @Autowired(SimpleLanguageService)
  private readonly simpleLanguageService: SimpleLanguageService;

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
      this.simpleLanguageService.registerHoverProvider(
        { pattern: '**/*.{js,jsx,ts,tsx,java,go}' },
        {
          provideHover: async (document: vscode.TextDocument, position: Position) => {
            const rootUri = this.workspaceUri;
            const info = new URI(document.uri);
            const payload = {
              repository: '/ide-s/TypeScript-Node-Starter',
              commit: 'test',
              path: rootUri.relative(info)?.toString()!,
              line: position.line,
              character: position.character,
            };
            return await this.lsifService.fetchLsifHover(payload);
          },
        },
      ),
    );

    this.addDispose(
      this.simpleLanguageService.registerDefinitionProvider(
        { pattern: '**/*.{js,jsx,ts,tsx,java,go}' },
        {
          provideDefinition: async (document: vscode.TextDocument, position: Position) => {
            const rootUri = this.workspaceUri;
            const info = new URI(document.uri);
            const payload = {
              repository: '/ide-s/TypeScript-Node-Starter',
              commit: 'test',
              path: rootUri.relative(info)?.toString()!,
              line: position.line,
              character: position.character,
            };
            return await this.lsifService.fetchLsifDefinition(payload);
          },
        },
      ),
    );

    this.addDispose(
      this.simpleLanguageService.registerReferenceProvider(
        { pattern: '**/*.{js,jsx,ts,tsx,java,go}' },
        {
          provideReferences: async (document: vscode.TextDocument, position: Position) => {
            const rootUri = this.workspaceUri;
            const info = new URI(document.uri);
            const payload = {
              repository: '/ide-s/TypeScript-Node-Starter',
              commit: 'test',
              path: rootUri.relative(info)?.toString()!,
              line: position.line,
              character: position.character,
            };
            return await this.lsifService.fetchLsifReferences(payload);
          },
        },
      ),
    );
  }
}
