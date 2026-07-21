export const ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM = 'acpBddBackendReadyFailure';
export const ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE = 'reject';
export const ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_PARAM = 'acpBddQueuedTurnStartFailure';
export const ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_VALUE = 'reject-once';
export const ACP_BDD_ATTACHMENT_FAILURE_QUERY_PARAM = 'acpBddAttachmentFailure';
export const ACP_BDD_ATTACHMENT_FAILURE_QUERY_VALUE = 'reject-once';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function canUseAcpBddRuntimeFixture(hostname: string | undefined): boolean {
  return Boolean(hostname && LOOPBACK_HOSTS.has(hostname));
}

function getBrowserLocation(): Location | undefined {
  return typeof window === 'undefined' ? undefined : window.location;
}

function shouldEnableFixture(
  search: string | undefined,
  hostname: string | undefined,
  queryParam: string,
  queryValue: string,
): boolean {
  if (!search || !canUseAcpBddRuntimeFixture(hostname)) {
    return false;
  }

  const params = new URLSearchParams(search);
  return params.get('aiNative') === 'true' && params.get(queryParam) === queryValue;
}

export function shouldForceAcpBackendReadinessFailure(
  search: string | undefined = getBrowserLocation()?.search,
  hostname: string | undefined = getBrowserLocation()?.hostname,
): boolean {
  return shouldEnableFixture(
    search,
    hostname,
    ACP_BDD_BACKEND_READY_FAILURE_QUERY_PARAM,
    ACP_BDD_BACKEND_READY_FAILURE_QUERY_VALUE,
  );
}

export function createAcpQueuedTurnStartFailureFixture(
  search: string | undefined = getBrowserLocation()?.search,
  hostname: string | undefined = getBrowserLocation()?.hostname,
): () => boolean {
  const enabled = shouldEnableFixture(
    search,
    hostname,
    ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_PARAM,
    ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_VALUE,
  );
  let consumed = false;
  return () => {
    if (!enabled || consumed) {
      return false;
    }
    consumed = true;
    return true;
  };
}

export function createAcpAttachmentFailureFixture(
  search: string | undefined = getBrowserLocation()?.search,
  hostname: string | undefined = getBrowserLocation()?.hostname,
): () => boolean {
  const enabled = shouldEnableFixture(
    search,
    hostname,
    ACP_BDD_ATTACHMENT_FAILURE_QUERY_PARAM,
    ACP_BDD_ATTACHMENT_FAILURE_QUERY_VALUE,
  );
  let consumed = false;
  return () => {
    if (!enabled || consumed) {
      return false;
    }
    consumed = true;
    return true;
  };
}
