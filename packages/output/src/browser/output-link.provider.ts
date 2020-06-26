import { Injectable, Autowired } from '@ali/common-di';
import { Uri } from '@ali/ide-core-common/src/uri';
import { rtrim, escapeRegExpCharacters } from '@ali/ide-core-common/lib/utils/strings';
import { format } from '@ali/ide-core-common/lib/utils/strings';
import { IWorkspaceService } from '@ali/ide-workspace';
import { join } from '@ali/ide-core-common/lib/path';

// Copy from VS Code src/vs/workbench/contrib/output/common/outputLinkComputer.ts
class OutputLinkComputer {

  private patterns: RegExp[];

  private workspaceUri: string;

  constructor(workspacePath?: string) {
    if (workspacePath) {
      this.workspaceUri = Uri.parse(workspacePath).path;
    }
    this.patterns = OutputLinkComputer.createPatterns(this.workspaceUri);
  }

  static createPatterns(workspaceUri?: string): RegExp[] {
    if (!workspaceUri) {
      return [];
    }
    const patterns: RegExp[] = [];

    const validPathCharacterPattern = '[^\\s\\(\\):<>"]';
    const validPathCharacterOrSpacePattern = `(?:${validPathCharacterPattern}| ${validPathCharacterPattern})`;
    const pathPattern = `${validPathCharacterOrSpacePattern}+\\.${validPathCharacterPattern}+`;
    const strictPathPattern = `${validPathCharacterPattern}+`;

    // Example: /workspaces/express/server.js on line 8, column 13
    patterns.push(new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern}) on line ((\\d+)(, column (\\d+))?)`, 'gi'));

    // Example: /workspaces/express/server.js:line 8, column 13
    patterns.push(new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern}):line ((\\d+)(, column (\\d+))?)`, 'gi'));

    // Example: /workspaces/mankala/Features.ts(45): error
    // Example: /workspaces/mankala/Features.ts (45): error
    // Example: /workspaces/mankala/Features.ts(45,18): error
    // Example: /workspaces/mankala/Features.ts (45,18): error
    // Example: /workspaces/mankala/Features Special.ts (45,18): error
    patterns.push(new RegExp(escapeRegExpCharacters(workspaceUri) + `(${pathPattern})(\\s?\\((\\d+)(,(\\d+))?)\\)`, 'gi'));

    // Example: at /workspaces/mankala/Game.ts
    // Example: at /workspaces/mankala/Game.ts:336
    // Example: at /workspaces/mankala/Game.ts:336:9
    patterns.push(new RegExp(escapeRegExpCharacters(workspaceUri) + `(${strictPathPattern})(:(\\d+))?(:(\\d+))?`, 'gi'));
    return patterns;
  }

  public computeLinks(model: monaco.editor.ITextModel) {
    const links: monaco.languages.ILink[] = [];
    const lines = model.getValue().split(/\r\n|\r|\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      this.patterns.forEach((pattern) => {
        pattern.lastIndex = 0; // the holy grail of software development

        let match: RegExpExecArray | null;
        let offset = 0;
        while ((match = pattern.exec(line)) !== null) {
          const resourcePath = rtrim(match[1], '.').replace(/\\/g, '/');
          const resourceUri = Uri.file(join(this.workspaceUri, resourcePath));
          let resourceString: string = resourceUri.toString();
          if (match[3]) {
            const lineNumber = match[3];

            if (match[5]) {
              const columnNumber = match[5];
              resourceString = format('{0}#{1},{2}', resourceString, lineNumber, columnNumber);
            } else {
              resourceString = format('{0}#{1}', resourceString, lineNumber);
            }
          }

          const fullMatch = rtrim(match[0], '.');

          const index = line.indexOf(fullMatch, offset);
          offset += index + fullMatch.length;

          const linkRange = {
            startColumn: index + 1,
            startLineNumber: i + 1,
            endColumn: index + 1 + fullMatch.length,
            endLineNumber: i + 1,
          };

          if (links.some((link) => monaco.Range.areIntersectingOrTouching(link.range, linkRange))) {
            return; // Do not detect duplicate links
          }

          links.push({
            range: linkRange,
            url: resourceString,
          });
        }
      });
    }

    return links;
  }

}

@Injectable()
export class OutputLinkProvider implements monaco.languages.LinkProvider {

  private linkComputer: OutputLinkComputer;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  constructor() {
    this.linkComputer = new OutputLinkComputer(
      this.workspaceService.workspace?.uri,
    );
  }

  provideLinks(model: monaco.editor.ITextModel): monaco.languages.ProviderResult<monaco.languages.ILinksList> {
    return { links: this.linkComputer.computeLinks(model) };
  }

  resolveLink?: ((link: monaco.languages.ILink, token: monaco.CancellationToken) => monaco.languages.ProviderResult<monaco.languages.ILink>) | undefined;

}
