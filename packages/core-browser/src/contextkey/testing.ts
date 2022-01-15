import { RawContextKey } from '../raw-context-key';

export const TestingServiceProviderCount = new RawContextKey('service.testing.providerCount', 0);
export const TestingServiceHasDebuggableContextKey = new RawContextKey('service.testing.hasDebuggableContext', false);
export const TestingHasAnyResults = new RawContextKey('testing.hasAnyResults', false);
export const TestingIsRunning = new RawContextKey('testing.isRunning', false);
