import { Injectable, Autowired } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common/lib';
import { join } from '@opensumi/ide-core-common/lib/path';
import { Uri, URI } from '@opensumi/ide-core-common/lib/uri';
import { rtrim, escapeRegExpCharacters, multiRightTrim } from '@opensumi/ide-core-common/lib/utils/strings';
import { format } from '@opensumi/ide-core-common/lib/utils/strings';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export interface IResourceCreator {
  toResource: (folderRelativePath: string) => string | undefined;
}

// Copy from VS Code src/vs/workbench/contrib/output/common/outputLinkComputer.ts
class OutputLinkComputer {
  private patterns = new Map<string /* folder uri */, RegExp[]>();

  private workspaceUris: Set<string> = new Set();

  constructor(workspacePath?: string) {
    if (workspacePath) {
      const workspaceUri = this.workspaceUri(workspacePath);
      this.workspaceUris.add(workspaceUri);

      const patterns = this.createPatterns(workspaceUri);
      this.patterns.set(workspaceUri, patterns);
    }
  }

  private workspaceUri(workspacePath: string): string {
    return Uri.parse(workspacePath).path;
  }

  public updateWorkspaceUri(workspacePath: string): void {
    const workspaceUri = this.workspaceUri(workspacePath);
    if (!this.workspaceUris.has(workspacePath)) {
      this.patterns.set(workspacePath, this.createPatterns(workspaceUri));
    }
  }

  private createPatterns(workspaceUri?: string): RegExp[] {
    if (!workspaceUri) {
      return [];
    }
    const patterns: RegExp[] = [];

    const validPathCharacterPattern = '[^\\s\\(\\):<>"]';
    const validPathCharacterOrSpacePattern = `(?:${validPathCharacterPattern}| ${validPathCharacterPattern})`;
    const pathPattern = `${validPathCharacterOrSpacePattern}+\\.${validPathCharacterPattern}+`;
    const strictPathPattern = `${validPathCharacterPattern}+`;

    // Example: /workspaces/express/server.js on line 8, column 13
    patterns.push(
      new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern}) on line ((\\d+)(, column (\\d+))?)`, 'gi'),
    );

    // Example: /workspaces/express/server.js:line 8, column 13
    patterns.push(
      new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern}):line ((\\d+)(, column (\\d+))?)`, 'gi'),
    );

    // Example: /workspaces/mankala/Features.ts(45): error
    // Example: /workspaces/mankala/Features.ts (45): error
    // Example: /workspaces/mankala/Features.ts(45,18): error
    // Example: /workspaces/mankala/Features.ts (45,18): error
    // Example: /workspaces/mankala/Features Special.ts (45,18): error
    patterns.push(
      new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern})(\\s?\\((\\d+)(,(\\d+))?)\\)`, 'gi'),
    );

    // Example: at /workspaces/mankala/Game.ts
    // Example: at /workspaces/mankala/Game.ts:336
    // Example: at /workspaces/mankala/Game.ts:336:9
    patterns.push(
      new RegExp(escapeRegExpCharacters(workspaceUri) + `(${strictPathPattern})(:(\\d+))?(:(\\d+))?`, 'gi'),
    );
    return patterns;
  }

  public computeLinks(model: ITextModel) {
    const links: monaco.languages.ILink[] = [];
    const lines = model.getValue().split(/\r\n|\r|\n/);

    // For each workspace root patterns
    for (const [folderUri, folderPatterns] of this.patterns) {
      const resourceCreator: IResourceCreator = {
        toResource: (folderRelativePath: string): string | undefined => {
          if (typeof folderRelativePath === 'string') {
            return URI.parse(join(folderUri, folderRelativePath)).withScheme('file').toString();
          }

          return undefined;
        },
      };

      for (let i = 0, len = lines.length; i < len; i++) {
        links.push(...this.toLinks(lines[i], i + 1, folderPatterns, resourceCreator));
      }
    }
    return links;
  }

  private toLinks(line: string, lineIndex: number, patterns: RegExp[], resourceCreator: IResourceCreator) {
    const links: monaco.languages.ILink[] = [];

    patterns.forEach((pattern) => {
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      let offset = 0;
      while ((match = pattern.exec(line)) !== null) {
        const folderRelativePath = rtrim(match[1], '.').replace(/\\/g, '/');
        let resourceString: string | undefined;
        try {
          resourceString = resourceCreator.toResource(folderRelativePath);
        } catch (error) {
          continue; // we might find an invalid URI and then we dont want to loose all other links
        }
        if (match[3]) {
          const lineNumber = match[3];

          if (match[5]) {
            const columnNumber = match[5];
            resourceString = format('{0}#{1},{2}', resourceString, lineNumber, columnNumber);
          } else {
            resourceString = format('{0}#{1}', resourceString, lineNumber);
          }
        }

        const fullMatch = multiRightTrim(match[0], ["'", ';', '.', '。']);
        const index = line.indexOf(fullMatch, offset);
        offset += index + fullMatch.length;

        const linkRange = {
          startColumn: index + 1,
          startLineNumber: lineIndex,
          endColumn: index + 1 + fullMatch.length,
          endLineNumber: lineIndex,
        };

        if (links.some((link) => monaco.Range.areIntersectingOrTouching(link.range, linkRange))) {
          return; // Do not detect duplicate links
        }

        links.push({
          range: linkRange,
          url: multiRightTrim(resourceString!, ["'", ';', '.', '。']),
        });
      }
    });
    return links;
  }
}

@Injectable()
export class OutputLinkProvider extends Disposable implements monaco.languages.LinkProvider {
  private linkComputer: OutputLinkComputer;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  constructor() {
    super();
    this.linkComputer = new OutputLinkComputer(this.workspaceService.workspace?.uri);

    this.addDispose(
      this.workspaceService.onWorkspaceChanged((e) => {
        for (const fileStat of e) {
          this.linkComputer.updateWorkspaceUri(fileStat.uri);
        }
      }),
    );
  }

  provideLinks(model: ITextModel): monaco.languages.ProviderResult<monaco.languages.ILinksList> {
    return { links: this.linkComputer.computeLinks(model) };
  }

  resolveLink?:
    | ((
        link: monaco.languages.ILink,
        token: monaco.CancellationToken,
      ) => monaco.languages.ProviderResult<monaco.languages.ILink>)
    | undefined;
}
