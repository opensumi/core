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

import { Injectable } from '@ali/common-di';
import { Window, OutputChannel, MessageActionItem, MessageType } from 'monaco-languageclient/lib/services';
import { getLogger } from '@ali/ide-core-common';

const logger = getLogger();
@Injectable()
export class WindowImpl implements Window {

    showMessage<T extends MessageActionItem>(type: MessageType, message: string, ...actions: T[]): Thenable<T | undefined> {
        const originalActions = new Map((actions || []).map((action) => [action.title, action] as [string, T]));
        const actionTitles = (actions || []).map((action) => action.title);
        const mapActionType: (result: string | undefined) => (T | undefined) = (result) => {
            if (!!result) {
                return originalActions.get(result);
            }
            return undefined;
        };
        logger.log('window msg service: ', message);
        return Promise.resolve(undefined);
    }

    createOutputChannel(name: string): OutputChannel {
        return {
            append: logger.log.bind(console),
            appendLine: logger.log.bind(console),
            show: async (preserveFocus?: boolean) => {

            },
            dispose: () => {

            },
        };
    }
}
