/********************************************************************************
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
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/core/src/browser/label-parser.ts

export interface LabelIcon {
  name: string;
  animation?: string;
}

export namespace LabelIcon {
  export function is(val: object): val is LabelIcon {
      return 'name' in val;
  }
}

export type LabelPart = string | LabelIcon;

export function parseLabel(text: string): LabelPart[] {
  const parserArray: LabelPart[] = [];
  let arrPointer = 0;
  let potentialIcon = '';

  for (let idx = 0; idx < text.length; idx++) {
      const char = text.charAt(idx);
      parserArray[arrPointer] = parserArray[arrPointer] || '';
      if (potentialIcon === '') {
          if (char === '$') {
              potentialIcon += char;
          } else {
              parserArray[arrPointer] += char;
          }
      } else if (potentialIcon === '$') {
          if (char === '(') {
              potentialIcon += char;
          } else {
              parserArray[arrPointer] += potentialIcon + char;
              potentialIcon = '';
          }
      } else {
          if (char === ')') {
              const iconClassArr = potentialIcon.substring(2, potentialIcon.length).split('~');
              if (parserArray[arrPointer] !== '') {
                  arrPointer++;
              }
              parserArray[arrPointer] = { name: iconClassArr[0], animation: iconClassArr[1] };
              arrPointer++;
              potentialIcon = '';
          } else {
              potentialIcon += char;
          }
      }
  }

  if (potentialIcon !== '') {
      parserArray[arrPointer] += potentialIcon;
  }

  return parserArray;
}
