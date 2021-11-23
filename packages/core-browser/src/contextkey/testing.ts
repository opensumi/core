import { RawContextKey } from '../raw-context-key';

export const TestingServiceProviderCount = new RawContextKey('service.testing.providerCount', 0);
export const TestingServiceHasDebuggableContextKey = new RawContextKey('service.testing.hasDebuggableContext', false);
