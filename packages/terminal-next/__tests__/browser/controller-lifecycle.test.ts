import { TerminalController } from '../../src/browser/terminal.controller';

describe('TerminalController lifecycle', () => {
  it('disposes the previous scoped context before binding a remounted Terminal view', () => {
    const controller = Object.create(TerminalController.prototype) as any;
    const previousContext = { dispose: jest.fn() };
    const nextContext = {
      isTerminalFocused: { set: jest.fn() },
      isTerminalViewInitialized: { set: jest.fn() },
    };
    Object.defineProperties(controller, {
      terminalContextKey: { configurable: true, value: previousContext, writable: true },
      injector: { value: { get: jest.fn(() => nextContext) } },
      _focus: { value: false },
    });

    controller.initContextKey(document.createElement('div'));

    expect(previousContext.dispose).toHaveBeenCalledTimes(1);
    expect(nextContext.isTerminalFocused.set).toHaveBeenCalledWith(false);
    expect(nextContext.isTerminalViewInitialized.set).toHaveBeenCalledWith(true);
  });

  it('does not require the Terminal view context key when first initialization finishes without the view', async () => {
    const controller = Object.create(TerminalController.prototype) as any;
    const disposable = { dispose: jest.fn() };
    Object.defineProperties(controller, {
      layoutService: {
        value: {
          viewReady: { promise: Promise.resolve() },
          getTabbarHandler: jest.fn(() => undefined),
        },
      },
      viewReady: { value: { promise: Promise.resolve() } },
      terminalTheme: { value: { terminalTheme: { background: '' } } },
      terminalView: {
        value: {
          onWidgetCreated: jest.fn(() => disposable),
          onWidgetDisposed: jest.fn(() => disposable),
          onWidgetEmpty: jest.fn(() => disposable),
          onWidgetSelected: jest.fn(() => disposable),
        },
      },
      themeService: { value: { onThemeChange: jest.fn(() => disposable) } },
      eventBus: { value: { onDirective: jest.fn(() => disposable) } },
      profileService: { value: { onDidChangeAvailableProfiles: jest.fn(() => disposable) } },
      config: { value: { layoutConfig: {} } },
      logger: { value: { warn: jest.fn() } },
      addDispose: { value: jest.fn() },
      registerContributedProfilesCommandAndMenu: { value: jest.fn() },
      _onThemeBackgroundChangeEmitter: { value: { fire: jest.fn() } },
      _ready: { value: { resolve: jest.fn() } },
    });

    await expect(controller.firstInitialize()).resolves.toBeUndefined();
    expect(controller._ready.resolve).toHaveBeenCalledTimes(1);
  });
});
