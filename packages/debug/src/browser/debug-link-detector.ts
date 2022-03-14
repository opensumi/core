/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/94c9ea46838a9a619aeafb7e8afd1170c967bb55/src/vs/workbench/contrib/debug/browser/linkDetector.ts

import { Injectable, Autowired } from '@opensumi/di';
import { Schemas, IOpenerService, OS, formatLocalize } from '@opensumi/ide-core-browser';
import { URI, IRange } from '@opensumi/ide-core-common';
import * as osPath from '@opensumi/ide-core-common/lib/path';
import * as platform from '@opensumi/ide-core-common/lib/platform';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient, FileStat } from '@opensumi/ide-file-service/lib/common';
import { IWorkspaceFolder } from '@opensumi/monaco-editor-core/esm/vs/platform/workspace/common/workspace';

import styles from './view/console/debug-console.module.less';

const CONTROL_CODES = '\\u0000-\\u0020\\u007f-\\u009f';
const WEB_LINK_REGEX = new RegExp(
  '(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|data:|www\\.)[^\\s' +
    CONTROL_CODES +
    '"]{2,}[^\\s' +
    CONTROL_CODES +
    '"\')}\\],:;.!?]',
  'ug',
);

const WIN_ABSOLUTE_PATH = /(?:[a-zA-Z]:(?:(?:\\|\/)[\w\.-]*)+)/;
const WIN_RELATIVE_PATH = /(?:(?:\~|\.)(?:(?:\\|\/)[\w\.-]*)+)/;
const WIN_PATH = new RegExp(`(${WIN_ABSOLUTE_PATH.source}|${WIN_RELATIVE_PATH.source})`);
const POSIX_PATH = /((?:\~|\.)?(?:\/[\w\.-]*)+)/;
const LINE_COLUMN = /(?:\:([\d]+))?(?:\:([\d]+))?/;
const PATH_LINK_REGEX = new RegExp(
  `${platform.isWindows ? WIN_PATH.source : POSIX_PATH.source}${LINE_COLUMN.source}`,
  'g',
);

const MAX_LENGTH = 2000;

type LinkKind = 'web' | 'path' | 'text';
interface LinkPart {
  kind: LinkKind;
  value: string;
  captures: string[];
}

@Injectable({ multiple: true })
export class LinkDetector {
  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  linkify(text: string, splitLines?: boolean, workspaceFolder?: IWorkspaceFolder): HTMLElement {
    if (splitLines) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        lines[i] = lines[i] + '\n';
      }
      if (!lines[lines.length - 1]) {
        lines.pop();
      }
      const elements = lines.map((line) => this.linkify(line, false, workspaceFolder));
      if (elements.length === 1) {
        return elements[0];
      }
      const container = document.createElement('span');
      elements.forEach((e) => container.appendChild(e));
      return container;
    }

    const container = document.createElement('span');
    for (const part of this.detectLinks(text)) {
      try {
        switch (part.kind) {
          case 'text':
            container.appendChild(document.createTextNode(part.value));
            break;
          case 'web':
            container.appendChild(this.createWebLink(part.value));
            break;
          case 'path': {
            const path = part.captures[0];
            const lineNumber = part.captures[1] ? Number(part.captures[1]) : 0;
            const columnNumber = part.captures[2] ? Number(part.captures[2]) : 0;
            container.appendChild(this.createPathLink(part.value, path, lineNumber, columnNumber, workspaceFolder));
            break;
          }
        }
      } catch (e) {
        container.appendChild(document.createTextNode(part.value));
      }
    }
    return container;
  }

  private createWebLink(url: string): Node {
    const link = this.createLink(url);

    const uri = URI.parse(url);
    this.decorateLink(link, async () => {
      if (uri.scheme === Schemas.file) {
        const fsPath = uri.toString();
        const path = OS.type() === OS.Type.Windows ? osPath.win32 : osPath.posix;
        const fileUrl = osPath.normalize(
          path.sep === osPath.posix.sep && platform.isWindows ? fsPath.replace(/\\/g, osPath.posix.sep) : fsPath,
        );

        await this.workbenchEditorService.open(URI.parse(fileUrl));
        return;
      }

      this.openerService.open(url);
    });

    return link;
  }

  private createPathLink(
    text: string,
    path: string,
    lineNumber: number,
    columnNumber: number,
    workspaceFolder: IWorkspaceFolder | undefined,
  ): Node {
    if (path[0] === '/' && path[1] === '/') {
      return document.createTextNode(text);
    }

    if (path[0] === '.') {
      if (!workspaceFolder) {
        return document.createTextNode(text);
      }
      const uri = workspaceFolder.toResource(path);
      const link = this.createLink(text);
      this.decorateLink(link, () => {
        this.workbenchEditorService.open(URI.parse(uri.toString()));
      });
      return link;
    }

    const link = this.createLink(text);
    link.tabIndex = 0;
    const uri = URI.file(osPath.normalize(path));
    this.fileServiceClient.getFileStat(uri.toString()).then((stat: FileStat | undefined) => {
      if (!stat || (stat && stat.isDirectory)) {
        return;
      }

      this.decorateLink(link, () => {
        this.workbenchEditorService.open(URI.parse(uri.toString()), {
          range: {
            startColumn: columnNumber,
            startLineNumber: lineNumber,
            endLineNumber: lineNumber,
            endColumn: columnNumber,
          } as IRange,
        });
      });
    });
    return link;
  }

  private createLink(text: string): HTMLElement {
    const link = document.createElement('a');
    link.textContent = text;
    return link;
  }

  private decorateLink(link: HTMLElement, onClick: (preserveFocus: boolean) => void) {
    link.classList.add(styles.link);
    link.title = formatLocalize('debug.console.followLink', platform.isMacintosh ? 'Cmd' : 'Ctrl');
    link.onmousemove = (event) => {
      link.classList.toggle(styles.pointer, platform.isMacintosh ? event.metaKey : event.ctrlKey);
    };
    link.onmouseleave = () => link.classList.remove(styles.pointer);
    link.onclick = (event) => {
      const selection = window.getSelection();
      if (!selection || selection.type === 'Range') {
        return;
      }
      if (!(platform.isMacintosh ? event.metaKey : event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      onClick(false);
    };
  }

  private detectLinks(text: string): LinkPart[] {
    if (text.length > MAX_LENGTH) {
      return [{ kind: 'text', value: text, captures: [] }];
    }

    const regexes: RegExp[] = [WEB_LINK_REGEX, PATH_LINK_REGEX];
    const kinds: LinkKind[] = ['web', 'path'];
    const result: LinkPart[] = [];

    const splitOne = (text: string, regexIndex: number) => {
      if (regexIndex >= regexes.length) {
        result.push({ value: text, kind: 'text', captures: [] });
        return;
      }
      const regex = regexes[regexIndex];
      let currentIndex = 0;
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const stringBeforeMatch = text.substring(currentIndex, match.index);
        if (stringBeforeMatch) {
          splitOne(stringBeforeMatch, regexIndex + 1);
        }
        const value = match[0];
        result.push({
          value,
          kind: kinds[regexIndex],
          captures: match.slice(1),
        });
        currentIndex = match.index + value.length;
      }
      const stringAfterMatches = text.substring(currentIndex);
      if (stringAfterMatches) {
        splitOne(stringAfterMatches, regexIndex + 1);
      }
    };

    splitOne(text, 0);
    return result;
  }
}
