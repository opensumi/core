import type { ErrorEvent } from 'reconnecting-websocket';

import { BasicEvent } from '../event-bus';

export class BrowserConnectionCloseEvent extends BasicEvent<void> {}

export class BrowserConnectionOpenEvent extends BasicEvent<void> {}

export class BrowserConnectionErrorEvent extends BasicEvent<ErrorEvent> {}
