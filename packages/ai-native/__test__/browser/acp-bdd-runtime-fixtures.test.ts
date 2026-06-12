import {
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM,
  ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE,
  canUseAcpBddRuntimeFixture,
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
});
