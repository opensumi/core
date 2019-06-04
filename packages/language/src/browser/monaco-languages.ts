/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { Injectable, Inject, markInjectable, setParameters } from '@ali/common-di';
import {
  MonacoLanguages as BaseMonacoLanguages, ProtocolToMonacoConverter,
  MonacoToProtocolConverter,
} from 'monaco-languageclient';
import { Languages, Language, WorkspaceSymbolProvider } from './language-client-services';
import { MonacoDiagnosticCollection } from 'monaco-languageclient/lib/monaco-diagnostic-collection';

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

markInjectable(ProtocolToMonacoConverter);
setParameters(ProtocolToMonacoConverter, []);
markInjectable(MonacoToProtocolConverter);
setParameters(MonacoToProtocolConverter, []);

@Injectable()
export class MonacoLanguages extends BaseMonacoLanguages implements Languages {

  readonly workspaceSymbolProviders: WorkspaceSymbolProvider[] = [];

  protected readonly makers = new Map<string, MonacoDiagnosticCollection>();

  constructor(
    public p2m: ProtocolToMonacoConverter,
    public m2p: MonacoToProtocolConverter,
  ) {
    super(p2m, m2p);
  }

  get languages(): Language[] {
    return [...this.mergeLanguages(monaco.languages.getLanguages()).values()];
  }

  getLanguage(languageId: string): Language | undefined {
    return this.mergeLanguages(monaco.languages.getLanguages().filter((language) => language.id === languageId)).get(languageId);
  }

  protected mergeLanguages(registered: monaco.languages.ILanguageExtensionPoint[]): Map<string, Mutable<Language>> {
    const languages = new Map<string, Mutable<Language>>();
    for (const { id, aliases, extensions, filenames } of registered) {
      const merged = languages.get(id) || {
        id,
        name: '',
        extensions: new Set(),
        filenames: new Set(),
      };
      if (!merged.name && aliases && aliases.length) {
        merged.name = aliases[0];
      }
      if (extensions && extensions.length) {
        for (const extension of extensions) {
          merged.extensions.add(extension);
        }
      }
      if (filenames && filenames.length) {
        for (const filename of filenames) {
          merged.filenames.add(filename);
        }
      }
      languages.set(id, merged);
    }
    for (const [id, language] of languages) {
      if (!language.name) {
        language.name = id;
      }
    }
    return languages;
  }

}
