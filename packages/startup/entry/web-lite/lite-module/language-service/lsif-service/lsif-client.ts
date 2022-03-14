import type * as vscode from 'vscode';

import { Autowired, Injectable } from '@opensumi/di';
import { URI, Uri } from '@opensumi/ide-core-common';
import { Position, Range, Location } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { ILsifPayload } from './base';

const config = {
  headers: {
    'redcoast-client': 'vscode-lsif',
    'content-type': 'application/json',
  },
};

@Injectable()
export class LsifClient {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  get workspaceUri() {
    return new URI(this.workspaceService.workspace!.uri);
  }

  async exists(repo: string, commit: string) {
    return await fetch('/lsif/exist', {
      method: 'POST',
      body: JSON.stringify({
        commit,
        repository: repo,
      }),
      ...config,
    }).then((res) => res.json());
  }

  async hover(params: ILsifPayload): Promise<vscode.Hover> {
    const response = await fetch('/lsif/hover', {
      method: 'POST',
      body: JSON.stringify({
        commit: params.commit,
        path: params.path,
        position: {
          character: params.character,
          line: params.line,
        },
        repository: params.repository,
      }),
      ...config,
    }).then((res) => res.json());

    const contents: vscode.MarkedString[] = [];

    if (response && response.data && response.data.content && response.data.content.contents) {
      const content = response.data.content.contents;
      contents.push(content.value);
    }
    return { contents };
  }

  async definition(params: ILsifPayload): Promise<vscode.Location[]> {
    const response = await fetch('/lsif/definition', {
      method: 'POST',
      body: JSON.stringify({
        commit: params.commit,
        path: params.path,
        position: {
          character: params.character,
          line: params.line,
        },
        repository: params.repository,
      }),
      ...config,
    }).then((res) => res.json());

    if (response && response.data) {
      const locations = response.data.content;
      if (locations && locations.length) {
        return locations.map((e: any) => {
          const localUri: Uri = Uri.file(`${this.workspaceUri.path}/${e.uri}`);
          // const range = e.range as Range;
          const start: Position = new Position(e.range.start.line, e.range.start.character);
          const end: Position = new Position(e.range.end.line, e.range.end.character);
          const range: Range = new Range(start, end);
          const location = new Location(localUri, range);
          return location;
        });
      }
    }
    return [];
  }

  async reference(params: ILsifPayload): Promise<vscode.Location[]> {
    const response = await fetch('/lsif/references', {
      method: 'POST',
      body: JSON.stringify({
        commit: params.commit,
        path: params.path,
        position: {
          character: params.character,
          line: params.line,
        },
        repository: params.repository,
      }),
      ...config,
    }).then((res) => res.json());

    if (response && response.data) {
      const locations = response.data.content;
      if (locations && locations.length) {
        return locations.map((e: any) => {
          const localUri: Uri = Uri.file(`${this.workspaceUri.path}/${e.uri}`);
          const start: Position = new Position(e.range.start.line, e.range.start.character);
          const end: Position = new Position(e.range.end.line, e.range.end.character);
          const range: Range = new Range(start, end);
          const location = new Location(localUri, range);
          return location;
        });
      }
    }
    return [];
  }
}
