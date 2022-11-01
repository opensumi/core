import { RawContextKey } from '../raw-context-key';

export const TestingServiceProviderCount = new RawContextKey('service.testing.providerCount', 0);
export const TestingServiceHasDebuggableContextKey = new RawContextKey('service.testing.hasDebuggableContext', false);
export const TestingHasAnyResults = new RawContextKey('testing.hasAnyResults', false);
export const TestingIsRunning = new RawContextKey('testing.isRunning', false);
export const TestingIsInPeek = new RawContextKey('testing.isInPeek', true);
export const TestingIsPeekVisible = new RawContextKey('testing.isPeekVisible', false);
export const TestingCanRefreshTests = new RawContextKey('testing.canRefresh', false);
