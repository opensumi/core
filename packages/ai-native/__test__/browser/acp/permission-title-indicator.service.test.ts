import { Emitter } from '@opensumi/ide-core-common';

import { AcpPermissionTitleIndicatorService } from '../../../src/browser/acp/permission-title-indicator.service';

jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
    Inject: noopDecorator,
    Optional: noopDecorator,
  };
});

type PanelLayoutMode = 'classic' | 'agentic';

function createServiceHarness(options?: {
  isElectronRenderer?: boolean;
  layoutMode?: PanelLayoutMode;
  pendingCount?: number;
  title?: string;
}) {
  let layoutMode = options?.layoutMode ?? 'agentic';
  let pendingCount = options?.pendingCount ?? 0;
  const pendingCountEmitter = new Emitter<void>();
  const panelLayoutEmitter = new Emitter<PanelLayoutMode>();

  document.title = options?.title ?? 'OpenSumi';

  const service = new AcpPermissionTitleIndicatorService();
  const appConfig = { isElectronRenderer: options?.isElectronRenderer ?? false };
  const permissionBridgeService = {
    getPendingCount: jest.fn(() => pendingCount),
    onPendingCountChange: pendingCountEmitter.event,
  };
  const panelLayoutService = {
    getLayoutMode: jest.fn(() => layoutMode),
    onDidChangePanelLayout: panelLayoutEmitter.event,
  };

  Object.defineProperty(service, 'appConfig', { value: appConfig, writable: true });
  Object.defineProperty(service, 'permissionBridgeService', { value: permissionBridgeService, writable: true });
  Object.defineProperty(service, 'panelLayoutService', { value: panelLayoutService, writable: true });

  return {
    service,
    permissionBridgeService,
    setPendingCount(nextCount: number) {
      pendingCount = nextCount;
      pendingCountEmitter.fire();
    },
    setLayoutMode(nextMode: PanelLayoutMode) {
      layoutMode = nextMode;
      panelLayoutEmitter.fire(nextMode);
    },
  };
}

describe('AcpPermissionTitleIndicatorService', () => {
  afterEach(() => {
    document.title = '';
  });

  it('prefixes the web agentic tab title with pending permission count and restores it when cleared', () => {
    const { service, setPendingCount } = createServiceHarness({
      layoutMode: 'agentic',
      pendingCount: 3,
      title: 'OpenSumi',
    });

    service.initialize();
    expect(document.title).toBe('(3) permission OpenSumi');

    setPendingCount(0);
    expect(document.title).toBe('OpenSumi');

    service.dispose();
  });

  it('updates the existing permission count without nesting title prefixes', () => {
    const { service, setPendingCount } = createServiceHarness({
      layoutMode: 'agentic',
      pendingCount: 1,
      title: 'OpenSumi',
    });

    service.initialize();
    setPendingCount(4);

    expect(document.title).toBe('(4) permission OpenSumi');

    service.dispose();
  });

  it('restores the base title when leaving agentic layout', () => {
    const { service, setLayoutMode } = createServiceHarness({
      layoutMode: 'agentic',
      pendingCount: 2,
      title: 'OpenSumi',
    });

    service.initialize();
    expect(document.title).toBe('(2) permission OpenSumi');

    setLayoutMode('classic');
    expect(document.title).toBe('OpenSumi');

    service.dispose();
  });

  it('does not modify the tab title in Electron renderer', () => {
    const { service, setPendingCount, setLayoutMode } = createServiceHarness({
      isElectronRenderer: true,
      layoutMode: 'agentic',
      pendingCount: 2,
      title: 'OpenSumi',
    });

    service.initialize();
    expect(document.title).toBe('OpenSumi');

    setPendingCount(5);
    setLayoutMode('classic');
    expect(document.title).toBe('OpenSumi');

    service.dispose();
  });
});
