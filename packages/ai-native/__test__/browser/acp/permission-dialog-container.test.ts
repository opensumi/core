import { ShowPermissionDialogParams } from '../../../lib/browser/acp/permission-bridge.service';
import { getAffectedFileName, getSmartTitle } from '../../../lib/browser/acp/permission-dialog-container';
import { PermissionDialogManager } from '../../../lib/browser/acp/permission-dialog-container';

// Mock @opensumi/di to make decorators no-ops
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

describe('getAffectedFileName()', () => {
  const baseParams: ShowPermissionDialogParams = {
    requestId: 'req-1',
    title: 'Test',
    kind: 'write',
    options: [],
    timeout: 5000,
  };

  it('should extract filename from locations path', () => {
    const params = {
      ...baseParams,
      locations: [{ path: '/workspace/src/file.ts' }],
    };

    expect(getAffectedFileName(params)).toBe('file.ts');
  });

  it('should extract filename with nested path', () => {
    const params = {
      ...baseParams,
      locations: [{ path: '/a/b/c/deep/file.json' }],
    };

    expect(getAffectedFileName(params)).toBe('file.json');
  });

  it('should fallback to "file" when no locations', () => {
    const params = { ...baseParams, locations: undefined };

    expect(getAffectedFileName(params)).toBe('file');
  });

  it('should fallback to "file" when locations is empty array', () => {
    const params = { ...baseParams, locations: [] };

    expect(getAffectedFileName(params)).toBe('file');
  });

  it('should handle path without slashes', () => {
    const params = {
      ...baseParams,
      locations: [{ path: 'filename.txt' }],
    };

    expect(getAffectedFileName(params)).toBe('filename.txt');
  });
});

describe('getSmartTitle()', () => {
  const baseParams: ShowPermissionDialogParams = {
    requestId: 'req-1',
    title: 'Default title',
    kind: 'write',
    locations: [{ path: '/workspace/src/file.ts' }],
    options: [],
    timeout: 5000,
  };

  it('should generate edit title for edit kind', () => {
    const params = { ...baseParams, kind: 'edit', content: 'some content' };

    expect(getSmartTitle(params)).toBe('Make this edit to file.ts?');
  });

  it('should generate edit title for write kind', () => {
    const params = { ...baseParams, kind: 'write', content: 'some content' };

    expect(getSmartTitle(params)).toBe('Make this edit to file.ts?');
  });

  it('should generate bash command title for execute kind', () => {
    const params = { ...baseParams, kind: 'execute' };

    expect(getSmartTitle(params)).toBe('Allow this bash command?');
  });

  it('should generate bash command title for bash kind', () => {
    const params = { ...baseParams, kind: 'bash' };

    expect(getSmartTitle(params)).toBe('Allow this bash command?');
  });

  it('should generate read title for read kind', () => {
    const params = { ...baseParams, kind: 'read' };

    expect(getSmartTitle(params)).toBe('Allow read from file.ts?');
  });

  it('should fallback to params.title for unknown kind', () => {
    const params = { ...baseParams, kind: 'unknown' };

    expect(getSmartTitle(params)).toBe('Default title');
  });

  it('should fallback to "Permission Required" when no title and unknown kind', () => {
    const params = { ...baseParams, kind: 'unknown', title: '' };

    expect(getSmartTitle(params)).toBe('Permission Required');
  });

  it('should handle missing kind', () => {
    const params = { ...baseParams, kind: undefined };

    expect(getSmartTitle(params)).toBe('Default title');
  });
});

describe('PermissionDialogManager', () => {
  let manager: PermissionDialogManager;

  const mockParams: ShowPermissionDialogParams = {
    requestId: 'req-1',
    title: 'Test',
    kind: 'write',
    options: [],
    timeout: 5000,
  };

  beforeEach(() => {
    manager = new PermissionDialogManager();
  });

  describe('addDialog()', () => {
    it('should add a new dialog', () => {
      manager.addDialog(mockParams);
      const dialogs = manager.getDialogs();

      expect(dialogs).toHaveLength(1);
      expect(dialogs[0].requestId).toBe('req-1');
      expect(dialogs[0].params).toBe(mockParams);
    });

    it('should not add duplicate dialogs with same requestId', () => {
      manager.addDialog(mockParams);
      manager.addDialog(mockParams);

      expect(manager.getDialogs()).toHaveLength(1);
    });

    it('should notify listeners when adding dialog', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.addDialog(mockParams);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ requestId: 'req-1' })]));
    });
  });

  describe('removeDialog()', () => {
    it('should remove dialog by requestId', () => {
      manager.addDialog(mockParams);
      manager.removeDialog('req-1');

      expect(manager.getDialogs()).toEqual([]);
    });

    it('should do nothing when requestId not found', () => {
      manager.addDialog(mockParams);
      manager.removeDialog('non-existent');

      expect(manager.getDialogs()).toHaveLength(1);
    });

    it('should notify listeners when removing dialog', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.addDialog(mockParams);
      manager.removeDialog('req-1');

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAll()', () => {
    it('should remove all dialogs', () => {
      manager.addDialog(mockParams);
      manager.addDialog({ ...mockParams, requestId: 'req-2' });

      manager.clearAll();

      expect(manager.getDialogs()).toEqual([]);
    });

    it('should notify listeners', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.addDialog(mockParams);
      manager.clearAll();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith([]);
    });
  });

  describe('getDialogs()', () => {
    it('should return a copy of dialogs', () => {
      manager.addDialog(mockParams);
      const dialogs1 = manager.getDialogs();
      const dialogs2 = manager.getDialogs();

      expect(dialogs1).toEqual(dialogs2);
      expect(dialogs1).not.toBe(dialogs2); // should be a copy
    });

    it('should return empty array when no dialogs', () => {
      expect(manager.getDialogs()).toEqual([]);
    });
  });

  describe('subscribe()', () => {
    it('should return unsubscribe function', () => {
      const unsubscribe = manager.subscribe(jest.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop receiving updates after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.addDialog(mockParams);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.addDialog({ ...mockParams, requestId: 'req-2' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);

      manager.addDialog(mockParams);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });
});
