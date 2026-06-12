export const ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM = 'acpBddBackendReadyFailure';
export const ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE = 'reject';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function canUseAcpBddRuntimeFixture(hostname: string | undefined): boolean {
  return Boolean(hostname && LOOPBACK_HOSTS.has(hostname));
}

function getBrowserLocation(): Location | undefined {
  return typeof window === 'undefined' ? undefined : window.location;
}

export function shouldForceAcpBackendReadinessFailure(
  search: string | undefined = getBrowserLocation()?.search,
  hostname: string | undefined = getBrowserLocation()?.hostname,
): boolean {
  if (!search || !canUseAcpBddRuntimeFixture(hostname)) {
    return false;
  }

  const params = new URLSearchParams(search);
  return (
    params.get('aiNative') === 'true' &&
    params.get(ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM) === ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE
  );
}
