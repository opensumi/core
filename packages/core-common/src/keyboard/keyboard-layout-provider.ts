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
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/browser/keyboard/browser-keyboard-layout-provider.ts

import { Event } from '@opensumi/ide-utils';

import { KeymapInfo } from './keymap';

export const keyboardPath = '/services/keyboard';

export const KeyboardNativeLayoutService = Symbol('KeyboardNativeLayoutService');

export interface KeyboardNativeLayoutService {
  getNativeLayout(): Promise<KeymapInfo | void>;
  allLayoutData: KeymapInfo[];
  currentLayoutData: KeymapInfo | null;
  currentLayoutSource: string;
  setLayoutData(layout: KeymapInfo | 'autodetect'): Promise<KeymapInfo | null>;
}

export const KeyboardLayoutChangeNotifierService = Symbol('KeyboardLayoutChangeNotifierService');

export interface KeyboardLayoutChangeNotifierService {
  onDidChangeNativeLayout: Event<KeymapInfo>;
}

export interface KeyValidationInput {
  code: string;
  character: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}
