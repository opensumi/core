import {
  ACP_BDD_ATTACHMENT_FAILURE_QUERY_PARAM,
  ACP_BDD_ATTACHMENT_FAILURE_QUERY_VALUE,
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM,
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE,
  canUseAcpBddRuntimeFixture,
  createAcpAttachmentFailureFixture,
  createAcpQueuedTurnStartFailureFixture,
  shouldForceAcpBackendReadinessFailure,
} from '../../src/browser/acp/acp-bdd-runtime-fixtures';

describe('ACP BDD runtime fixtures', () => {
  it('only enables runtime fixture switches on loopback hosts', () => {
    expect(canUseAcpBddRuntimeFixture('localhost')).toBe(true);
    expect(canUseAcpBddRuntimeFixture('127.0.0.1')).toBe(true);
    expect(canUseAcpBddRuntimeFixture('::1')).toBe(true);
    expect(canUseAcpBddRuntimeFixture('[::1]')).toBe(true);
    expect(canUseAcpBddRuntimeFixture('example.com')).toBe(false);
    expect(canUseAcpBddRuntimeFixture(undefined)).toBe(false);
  });

  it('requires the aiNative test mode query and explicit readiness failure value', () => {
    const enabledSearch = `?aiNative=true&${ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM}=${ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE}`;

    expect(shouldForceAcpBackendReadinessFailure(enabledSearch, 'localhost')).toBe(true);
    expect(shouldForceAcpBackendReadinessFailure(enabledSearch, 'example.com')).toBe(false);
    expect(
      shouldForceAcpBackendReadinessFailure(`?${ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM}=reject`, 'localhost'),
    ).toBe(false);
    expect(
      shouldForceAcpBackendReadinessFailure(
        `?aiNative=true&${ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM}=false`,
        'localhost',
      ),
    ).toBe(false);
  });

  it('enables queued-turn start failure once on local aiNative runs', () => {
    const search = '?aiNative=true&acpBddQueuedTurnStartFailure=reject-once';
    const shouldFail = createAcpQueuedTurnStartFailureFixture(search, 'localhost');
    expect(shouldFail()).toBe(true);
    expect(shouldFail()).toBe(false);
    expect(createAcpQueuedTurnStartFailureFixture(search, 'example.com')()).toBe(false);
    expect(createAcpQueuedTurnStartFailureFixture('?acpBddQueuedTurnStartFailure=reject-once', 'localhost')()).toBe(
      false,
    );
  });

  it('enables attachment failure once on local aiNative runs', () => {
    const search = `?aiNative=true&${ACP_BDD_ATTACHMENT_FAILURE_QUERY_PARAM}=${ACP_BDD_ATTACHMENT_FAILURE_QUERY_VALUE}`;
    const shouldFail = createAcpAttachmentFailureFixture(search, 'localhost');
    expect(shouldFail()).toBe(true);
    expect(shouldFail()).toBe(false);
    expect(createAcpAttachmentFailureFixture(search, 'example.com')()).toBe(false);
    expect(createAcpAttachmentFailureFixture('?acpBddAttachmentFailure=reject-once', 'localhost')()).toBe(false);
  });
});
