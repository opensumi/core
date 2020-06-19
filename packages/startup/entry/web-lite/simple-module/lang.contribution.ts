import { Autowired } from '@ali/common-di';
import { Disposable, Domain, URI, Uri } from '@ali/ide-core-common';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { Position, Range, Location } from '@ali/ide-kaitian-extension/src/common/vscode/ext-types';
import * as vscode from 'vscode';
import { IWorkspaceService } from '@ali/ide-workspace';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';

import { SimpleLanguageService } from '../modules/simple-language-service';
import * as lsifApi from '../modules/lsif/api';
import { IMetaService } from './meta-service';
import { tsLangBasicExtContributes } from '../ide-exts/ts';

@Domain(ClientAppContribution)
export class LangContribution extends Disposable implements ClientAppContribution {
  @Autowired(SimpleLanguageService)
  private readonly simpleLanguageService: SimpleLanguageService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(TextmateService)
  private readonly textMateService: TextmateService;

  get workspaceUri() {
    return new URI(this.workspaceService.workspace!.uri);
  }

  get projectRootPath() {
    return this.workspaceUri.path;
  }

  // 由于使用了预加载 monaco, 导致 lang/grammar contribute 提前
  // 由于依赖了 kt-ext fs provider 注册，因此这里从 onMonacoLoad 改为 onStart
  onStart() {
    // languages/grammars registration
    tsLangBasicExtContributes.pkgJSON.contributes.languages.forEach((language) => {
      this.textMateService.registerLanguage(language as any, URI.parse(tsLangBasicExtContributes.extPath));
    });

    tsLangBasicExtContributes.pkgJSON.contributes.grammars.forEach((grammar) => {
      this.textMateService.registerGrammar(grammar as any, URI.parse(tsLangBasicExtContributes.extPath));
    });

    // lsif registration
    this.addDispose(
      this.simpleLanguageService.registerHoverProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideHover: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const hoverParam = {
            repository: this.metaService.repo,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString(),
            line: position.line,
            character: position.character,
          };
          // console.log(`hover param: ${JSON.stringify(hoverParam, null, 2)}`);
          const response = await lsifApi.hover(hoverParam);
          // console.log(`hover response: ${JSON.stringify(response.data, null, 2)}`);
          if (response && response.data && response.data.content && response.data.content.contents) {
            const content = response.data.content.contents;
            return {
              contents: [content.value],
            };
          }
          return {
            contents: [],
          };
        },
      }),
    );

    this.addDispose(
      this.simpleLanguageService.registerDefinitionProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideDefinition: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const definitionParam = {
            repository: this.metaService.repo,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString(),
            line: position.line,
            character: position.character,
          };
          // console.log(`definition param: ${JSON.stringify(definitionParam, null, 2)}`);
          const response = await lsifApi.definition(definitionParam);
          // console.log(`definition response: ${JSON.stringify(response.data, null, 2)}`);
          if (response && response.data) {
            const locations = response.data.content;
            if (locations && locations.length) {
              return locations.map((e: any) => {
                const localUri: Uri = Uri.file(`${this.projectRootPath}/${e.uri}`);
                // const range = e.range as Range;
                const start: Position = new Position(e.range.start.line, e.range.start.character);
                const end: Position = new Position(e.range.end.line, e.range.end.character);
                const range: Range = new Range(start, end);
                const location = new Location(localUri, range);
                // const location = new Location(localUri, e.range);
                return location;
              });
            }
          }
          return null;
        },
      }),
    );

    this.addDispose(
      this.simpleLanguageService.registerReferenceProvider({ pattern: '**/*.{js,jsx,ts,tsx,java,go}' }, {
        provideReferences: async (document: vscode.TextDocument, position: Position) => {
          const rootUri = this.workspaceUri;
          const info = new URI(document.uri);
          const referenceParam = {
            repository: this.metaService.repo,
            commit: this.metaService.ref,
            path: rootUri.relative(info)?.toString(),
            line: position.line,
            character: position.character,
          };
          // console.log(`reference param: ${JSON.stringify(referenceParam, null, 2)}`);
          const response = await lsifApi.reference(referenceParam);
          // console.log(`reference response: ${JSON.stringify(response.data, null, 2)}`);
          if (response && response.data) {
            const locations = response.data.content;
            if (locations && locations.length) {
              return locations.map((e: any) => {
                const localUri: Uri = Uri.file(`${this.projectRootPath}/${e.uri}`);
                const start: Position = new Position(e.range.start.line, e.range.start.character);
                const end: Position = new Position(e.range.end.line, e.range.end.character);
                const range: Range = new Range(start, end);
                const location = new Location(localUri, range);
                // const location = new Location(localUri, e.range);
                return location;
              });
            }
          }
          return null;
        },
      }),
    );
  }
}
