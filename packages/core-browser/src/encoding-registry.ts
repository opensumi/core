/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// based on https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/workbench/services/textfile/browser/textFileService.ts#L491

import { Injectable, Autowired } from '@ali/common-di';
import { URI, Disposable, IDisposable } from '@ali/ide-core-common';
import { UTF8, encodingExists } from '@ali/ide-core-common/lib/encoding';
import { PreferenceService } from './preferences';
import { getLanguageIdFromMonaco } from './services/label-service';

export interface EncodingOverride {
  parent?: URI;
  extension?: string;
  scheme?: string;
  encoding: string;
}

@Injectable()
export class EncodingRegistry {

  protected readonly encodingOverrides: EncodingOverride[] = [];

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  registerOverride(override: EncodingOverride): IDisposable {
    this.encodingOverrides.push(override);
    return Disposable.create(() => {
      const index = this.encodingOverrides.indexOf(override);
      if (index !== -1) {
        this.encodingOverrides.splice(index, 1);
      }
    });
  }

  getEncodingForResource(resource: URI, preferredEncoding?: string): string {
    let fileEncoding: string;

    const override = this.getEncodingOverride(resource);
    if (override) {
      fileEncoding = override; // encoding override always wins
    } else if (preferredEncoding) {
      fileEncoding = preferredEncoding; // preferred encoding comes second
    } else {
      fileEncoding = this.preferenceService.get<string>('files.encoding', undefined, resource.toString(), getLanguageIdFromMonaco(resource)!)!;
    }

    if (!fileEncoding || !encodingExists(fileEncoding)) {
      return UTF8; // the default is UTF 8
    }

    return fileEncoding;
  }

  protected getEncodingOverride(resource: URI): string | undefined {
    if (this.encodingOverrides && this.encodingOverrides.length) {
      for (const override of this.encodingOverrides) {
        if (override.parent && resource.isEqualOrParent(override.parent)) {
          return override.encoding;
        }

        if (override.extension && resource.path.ext === `.${override.extension}`) {
          return override.encoding;
        }

        if (override.scheme && override.scheme === resource.scheme) {
          return override.encoding;
        }
      }
    }

    return undefined;
  }
}
