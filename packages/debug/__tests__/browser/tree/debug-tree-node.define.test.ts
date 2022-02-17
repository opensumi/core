import {
  ExpressionContainer,
  ExpressionNode,
  DebugVariable,
  DebugVariableContainer,
  DebugScope,
  DebugWatchNode,
  DebugConsoleNode,
  DebugConsoleVariableContainer,
  DebugConsoleRoot,
  DebugWatchRoot,
  DebugVariableRoot,
  DebugHoverVariableRoot,
} from '@opensumi/ide-debug/lib/browser/tree';

describe('ExpressionContainer', () => {
  let rootNode: ExpressionContainer;
  let node: ExpressionContainer;

  const mockSession = {} as any;

  const mockRootNodeOptions = {
    session: mockSession,
    variablesReference: 1001,
    namedVariables: 0,
    indexedVariables: 0,
    startOfVariables: 8,
    source: { name: 'test' },
    line: 1,
  };

  const mockNodeOptions = {
    session: mockSession,
    variablesReference: 1,
    namedVariables: 0,
    indexedVariables: 0,
    startOfVariables: 8,
    source: { name: 'test' },
    line: 1,
  };

  beforeAll(() => {
    rootNode = new ExpressionContainer(mockRootNodeOptions, undefined);
    node = new ExpressionContainer(mockNodeOptions, rootNode);
  });

  it('should have correct property', () => {
    expect(node.parent).toEqual(rootNode);
    expect(node.expanded).toBeFalsy();
    expect(node.variablesReference).toBe(mockNodeOptions.variablesReference);
    expect(node.namedVariables).toBe(mockNodeOptions.namedVariables);
    expect(node.indexedVariables).toBe(mockNodeOptions.indexedVariables);
    expect(node.startOfVariables).toBe(mockNodeOptions.startOfVariables);
    expect(node.source).toBe(mockNodeOptions.source);
    expect(node.line).toBe(mockNodeOptions.line);
    expect(node.badge).toBe(`${mockNodeOptions.source.name}:${mockNodeOptions.line}`);
  });

  it('static method should be work', () => {
    expect(ExpressionContainer.is({})).toBeFalsy();
    expect(ExpressionContainer.is(rootNode)).toBeTruthy();
  });
});

describe('ExpressionNode', () => {
  let rootNode: ExpressionContainer;
  let node: ExpressionNode;

  const mockSession = {} as any;

  const mockRootNodeOptions = {
    session: mockSession,
    variablesReference: 1,
    namedVariables: 0,
    indexedVariables: 0,
    startOfVariables: 8,
    source: { name: 'test' },
    line: 1,
  };

  const mockNodeOptions = {
    session: mockSession,
    variablesReference: 1,
    namedVariables: 0,
    indexedVariables: 0,
    startOfVariables: 8,
    source: { name: 'test' },
    line: 1,
  };

  beforeAll(() => {
    rootNode = new ExpressionContainer(mockRootNodeOptions, undefined);
    node = new ExpressionNode(mockNodeOptions, rootNode);
  });

  it('should have correct property', () => {
    expect(node.parent).toEqual(rootNode);
    expect(node.namedVariables).toBe(mockNodeOptions.namedVariables);
    expect(node.indexedVariables).toBe(mockNodeOptions.indexedVariables);
    expect(node.source).toBe(mockNodeOptions.source);
    expect(node.line).toBe(mockNodeOptions.line);
    expect(node.badge).toBe(`${mockNodeOptions.source.name}:${mockNodeOptions.line}`);
  });
});

describe('DebugVariableRoot —— DebugVariable —— DebugVariableContainer', () => {
  let containerNode: DebugVariableContainer;
  let node: DebugVariable;
  let root: DebugVariableRoot;

  const mockSession = {
    capabilities: {
      supportsSetVariable: true,
    },
    sendRequest: jest.fn(() => ({ body: {} })),
  } as any;

  const mockRootNodeOptions = {
    session: mockSession,
    variable: {
      name: 'root',
      value: 'root',
      variablesReference: 1001,
      namedVariables: 0,
      indexedVariables: 0,
      startOfVariables: 8,
    },
  };

  const mockNodeOptions = {
    session: mockSession,
    variable: {
      name: 'test',
      value: 'test',
      variablesReference: 1002,
      namedVariables: 0,
      indexedVariables: 0,
      startOfVariables: 8,
    },
  };

  const mockDocument = {
    queryCommandSupported: jest.fn(() => true),
    getSelection: jest.fn(),
  };

  beforeAll(() => {
    (global as any).document = mockDocument;
    root = new DebugVariableRoot(mockRootNodeOptions.session);
    containerNode = new DebugVariableContainer(mockRootNodeOptions.session, mockRootNodeOptions.variable, root);
    node = new DebugVariable(mockNodeOptions.session, mockNodeOptions.variable, root);
  });

  it('should have correct property', () => {
    expect(node.parent).toEqual(root);
    expect(node.variablesReference).toBe(mockNodeOptions.variable.variablesReference);
    expect(node.namedVariables).toBe(mockNodeOptions.variable.namedVariables);
    expect(node.indexedVariables).toBe(mockNodeOptions.variable.indexedVariables);
    expect(node.variable).toEqual(mockNodeOptions.variable);
    expect(node.name).toEqual(mockNodeOptions.variable.name);
    expect(node.value).toEqual(mockNodeOptions.variable.value);
    expect(node.description).toEqual(mockNodeOptions.variable.value);

    expect(containerNode.parent).toEqual(root);
    expect(containerNode.name).toBe(mockRootNodeOptions.variable.name);
    expect(containerNode.value).toBe(mockRootNodeOptions.variable.value);
    expect(containerNode.tooltip).toBe(mockRootNodeOptions.variable.value);
    expect(containerNode.supportSetVariable).toBe(mockRootNodeOptions.session.capabilities.supportsSetVariable);
    expect(typeof containerNode.setValue).toBe('function');

    expect(root.expanded).toBeTruthy();
  });

  it('static method should be work', () => {
    expect(DebugVariableContainer.is({})).toBeFalsy();
    expect(DebugVariableContainer.is(containerNode)).toBeTruthy();
  });

  it('setValue method should be work', async () => {
    await containerNode.setValue('value_1');
    expect(mockSession.sendRequest).toBeCalledTimes(1);
    await node.setValue('value_2');
    expect(mockSession.sendRequest).toBeCalledTimes(2);
  });
});

describe('DebugScope', () => {
  let scope: DebugScope;

  const mockSession = {} as any;

  const mockScope = {
    name: 'global',
    variablesReference: 1,
    namedVariables: 0,
    indexedVariables: 0,
  } as any;

  const root = new DebugVariableRoot(mockSession);

  beforeAll(() => {
    scope = new DebugScope(mockScope, mockSession, root);
  });

  it('should have correct property', () => {
    expect(scope.name).toEqual(mockScope.name);
    expect(scope.variablesReference).toBe(mockScope.variablesReference);
    expect(scope.namedVariables).toBe(mockScope.namedVariables);
    expect(scope.indexedVariables).toBe(mockScope.indexedVariables);
    expect(scope.parent).toBeDefined();
  });
});

describe('DebugWatchRoot —— DebugWatchNode', () => {
  let node: DebugWatchNode;
  let root: DebugWatchRoot;

  const mockSession = {
    evaluate: jest.fn(() => ({ body: {} })),
    capabilities: {
      supportsValueFormattingOptions: true,
    },
  } as any;

  const expression = 'test';

  beforeAll(() => {
    root = new DebugWatchRoot(mockSession, []);
    node = new DebugWatchNode(mockSession, expression, root);
  });

  it('should have correct property', () => {
    expect(node.description).toBe(DebugWatchNode.notAvailable);
    expect(node.available).toBeFalsy();

    expect(root.expanded).toBeTruthy();
  });

  it('evaluate method should be work', async () => {
    await node.evaluate();
    expect(mockSession.evaluate).toBeCalledTimes(1);
  });

  it('getClipboardValue method should be work', async () => {
    await node.getClipboardValue();
    expect(mockSession.evaluate).toBeCalledTimes(2);
  });

  it('updatePresetChildren method should be work', () => {
    root.updatePresetChildren([node]);
    expect(root.presetChildren.length).toBe(1);
  });
});

describe('DebugConsoleRoot —— DebugConsoleNode —— DebugConsoleVariableContainer', () => {
  let node: DebugConsoleNode;
  let containerNode: DebugConsoleVariableContainer;
  let root: DebugConsoleRoot;

  const mockSession = {
    evaluate: jest.fn(() => ({ body: {} })),
    sendRequest: jest.fn(() => ({ body: {} })),
    capabilities: {
      supportsValueFormattingOptions: true,
    },
  } as any;

  const mockContainerNodeOptions = {
    session: mockSession,
    variable: {
      name: 'root',
      value: 'root',
      variablesReference: 1001,
      namedVariables: 0,
      indexedVariables: 0,
      startOfVariables: 8,
    },
  };

  const expression = 'test';

  beforeAll(() => {
    root = new DebugConsoleRoot(mockSession, undefined);
    containerNode = new DebugConsoleVariableContainer(
      mockContainerNodeOptions.session,
      mockContainerNodeOptions.variable,
      root,
    );
    node = new DebugConsoleNode(mockSession, expression, root);
  });

  it('should have correct property', () => {
    expect(node.available).toBeFalsy();
    expect(node.description).toBeUndefined();

    expect(containerNode.uniqueID).toBe(DebugConsoleVariableContainer.uniqueID);
    expect(containerNode.value).toBe(mockContainerNodeOptions.variable.value);
    expect(containerNode.description).toBe(mockContainerNodeOptions.variable.value);
    expect(containerNode.tooltip).toBe(mockContainerNodeOptions.variable.value);

    expect(root.expanded).toBeTruthy();
  });

  it('static method should be work', () => {
    expect(DebugConsoleVariableContainer.is({})).toBeFalsy();
    expect(DebugConsoleVariableContainer.is(containerNode)).toBeTruthy();
    expect(DebugConsoleRoot.is(containerNode)).toBeFalsy();
    expect(DebugConsoleRoot.is(root)).toBeTruthy();
  });

  it('setValue method should be work', async () => {
    await containerNode.setValue('test');
    expect(mockSession.sendRequest).toBeCalledTimes(1);
  });

  it('evaluate method should be work', async () => {
    await node.evaluate();
    expect(mockSession.evaluate).toBeCalledTimes(1);
  });

  it('updatePresetChildren method should be work', () => {
    root.updatePresetChildren([node, containerNode]);
    expect(root.presetChildren.length).toBe(2);
  });
});

describe('DebugHoverVariableRoot', () => {
  let root: DebugHoverVariableRoot;

  const mockSession = {
    evaluate: jest.fn(() => ({ body: {} })),
    capabilities: {
      supportsValueFormattingOptions: true,
    },
  } as any;
  const expression = 'console.log';

  beforeAll(() => {
    root = new DebugHoverVariableRoot(expression, mockSession);
  });

  it('should have correct property', () => {
    expect(root.expanded).toBeTruthy();
    expect(root.available).toBeFalsy();
  });

  it('evaluate method should be work', async () => {
    await root.evaluate();
    expect(mockSession.evaluate).toBeCalledTimes(1);
  });
});
