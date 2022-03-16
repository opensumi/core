/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/debug/src/browser/model/debug-source.ts

import { URI, Uri, IRange } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService, IResourceOpenOptions } from '@opensumi/ide-editor';
import { IFileServiceClient, FileStat } from '@opensumi/ide-file-service';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { DebugSession } from '../debug-session';
import { DebugModelManager } from '../editor';

import { DebugStackFrame } from './debug-stack-frame';


export class DebugSourceData {
  readonly raw: DebugProtocol.Source;
}

export class DebugSource extends DebugSourceData {
  constructor(
    protected readonly session: DebugSession,
    protected readonly labelProvider: LabelService,
    protected readonly modelManager: DebugModelManager,
    protected readonly workbenchEditorService: WorkbenchEditorService,
    protected readonly fileSystem: IFileServiceClient,
  ) {
    super();
  }

  get uri(): URI {
    return DebugSource.toUri(this.raw);
  }

  update(data: Partial<DebugSourceData>): void {
    Object.assign(this, data);
  }

  async open(options: IResourceOpenOptions, frame?: DebugStackFrame) {
    if (this.uri.scheme === DebugSource.SCHEME) {
      const content = await this.load();
      await this.fileSystem.setContent(
        {
          uri: this.uri.toString(),
          lastModification: 0,
        } as FileStat,
        content,
      );
    }

    if (frame && frame.raw) {
      const { line, column } = frame.raw;
      const range: IRange = {
        startLineNumber: line,
        startColumn: typeof column === 'number' ? column : 0,
        endLineNumber: line,
        endColumn: Infinity,
      };
      await this.workbenchEditorService.open(this.uri, {
        ...options,
        range,
      });
      // 更新当前进程的currentFrame为选中frame
      frame.thread.currentFrame = frame;
      // currentFrame变化会通知打开对应文件
      const models = this.modelManager.resolve(this.uri);
      if (models) {
        for (const model of models) {
          model.focusStackFrame();
        }
      }
    } else {
      await this.workbenchEditorService.open(this.uri, options);
    }
  }

  async load(): Promise<string> {
    const source = this.raw;
    const sourceReference = source.sourceReference!;
    const response = await this.session.sendRequest('source', {
      sourceReference,
      source,
    });
    return response.body.content;
  }

  get inMemory(): boolean {
    return this.uri.scheme === DebugSource.SCHEME;
  }

  get reference(): number | undefined {
    return this.raw.sourceReference;
  }

  get name(): string {
    if (this.inMemory) {
      return this.raw.name || this.uri.path.base || this.uri.path.toString();
    }
    return this.labelProvider.getName(this.uri);
  }

  get longName(): string {
    if (this.inMemory) {
      return this.name;
    }
    return this.labelProvider.getLongName(this.uri);
  }

  static SCHEME = 'debug';
  static SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9\+\-\.]+:/;
  static toUri(raw: DebugProtocol.Source): URI {
    if (raw.sourceReference && raw.sourceReference > 0) {
      return new URI().withScheme(DebugSource.SCHEME).withPath(raw.name!).withQuery(String(raw.sourceReference));
    }
    if (!raw.path) {
      throw new Error('Unrecognized source type: ' + JSON.stringify(raw));
    }
    if (raw.path.match(DebugSource.SCHEME_PATTERN)) {
      return new URI(raw.path);
    }
    return new URI(Uri.file(raw.path));
  }
}
