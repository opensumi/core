import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Autowired, Injectable } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Domain, useInjectable } from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser/lib/components';

import { AcpPermissionBridgeService, ShowPermissionDialogParams } from './permission-bridge.service';

// Module load logging for debugging

// 默认权限选项（仅作为类型参考，实际选项由后端传入）
// 后端传入的选项可能包含：allow_always, allow_once, reject_once 等

/**
 * 简化的全局对话框状态管理
 */
@Injectable()
class PermissionDialogManager {
  private listeners: Array<(dialogs: DialogState[]) => void> = [];
  private dialogs: DialogState[] = [];

  addDialog(params: ShowPermissionDialogParams) {
    const exists = this.dialogs.find((d) => d.requestId === params.requestId);

    if (!exists) {
      this.dialogs.push({
        requestId: params.requestId,
        params,
      });
      this.notifyListeners();
    }
  }

  removeDialog(requestId: string) {
    const index = this.dialogs.findIndex((d) => d.requestId === requestId);
    if (index !== -1) {
      this.dialogs.splice(index, 1);
      this.notifyListeners();
    }
  }

  clearAll() {
    this.dialogs = [];
    this.notifyListeners();
  }

  getDialogs(): DialogState[] {
    return [...this.dialogs];
  }

  subscribe(listener: (dialogs: DialogState[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.dialogs]));
  }
}

interface DialogState {
  requestId: string;
  params: ShowPermissionDialogParams;
}

/**
 * 智能文件名提取工具函数
 */
const getAffectedFileName = (params: ShowPermissionDialogParams): string => {
  // 优先从 locations 获取文件名
  const fromLocations = params.locations?.[0]?.path;
  if (fromLocations) {
    return fromLocations.split('/').pop() || fromLocations;
  }

  return 'file';
};

/**
 * 智能标题生成工具函数
 */
const getSmartTitle = (params: ShowPermissionDialogParams): string => {
  const kind = params.kind;

  if (kind === 'edit' || kind === 'write') {
    const fileName = getAffectedFileName(params);
    return `Make this edit to ${fileName}?`;
  }

  if (kind === 'execute' || kind === 'bash') {
    return 'Allow this bash command?';
  }

  if (kind === 'read') {
    const fileName = getAffectedFileName(params);
    return `Allow read from ${fileName}?`;
  }

  return params.title || 'Permission Required';
};

@Injectable()
@Domain(ComponentContribution)
export class AcpPermissionDialogContribution implements ComponentContribution {
  @Autowired(AcpPermissionBridgeService)
  private permissionBridgeService!: AcpPermissionBridgeService;

  @Autowired(PermissionDialogManager)
  private dialogManager!: PermissionDialogManager;

  constructor() {
    // 监听权限请求事件 - 添加对话框
    this.permissionBridgeService.onDidRequestPermission((params: ShowPermissionDialogParams) => {
      this.dialogManager.addDialog(params);
    });

    // 监听权限结果事件 - 处理超时等结果
    this.permissionBridgeService.onDidReceivePermissionResult((result) => {
      // 超时或取消时关闭对话框
      if (result.decision.type === 'timeout' || result.decision.type === 'cancelled') {
        this.dialogManager.removeDialog(result.requestId);
      }
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('acp-permission-dialog-container', {
      id: 'acp-permission-dialog-container',
      component: AcpPermissionDialogContainer,
    });
  }
}

/**
 * 函数组件形式的权限对话框容器
 */
const AcpPermissionDialogContainer: React.FC = () => {
  // 状态管理
  const [dialogs, setDialogs] = useState<DialogState[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const functionComponentDialogManager = useInjectable<PermissionDialogManager>(PermissionDialogManager);

  // Ref 管理
  const containerRef = useRef<HTMLDivElement>(null);

  // 组件挂载：订阅对话框状态变化
  useEffect(() => {
    const unsubscribe = functionComponentDialogManager.subscribe((newDialogs) => {
      setDialogs(newDialogs);
      setFocusedIndex(0); // 重置焦点索引
    });

    // 初始化当前 dialogs
    setDialogs(functionComponentDialogManager.getDialogs());

    return unsubscribe;
  }, []);

  // 键盘导航处理函数（使用 useCallback 优化性能）
  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      const options = dialogs[0]?.params.options || [];

      if (dialogs.length === 0) {
        return;
      }

      // 数字键 1-9 支持快捷选择
      const numMatch = e.key.match(/^[1-9]$/);
      if (numMatch) {
        const index = parseInt(e.key, 10) - 1;
        if (index < options.length) {
          e.preventDefault();
          handleDialogSelect(options[index].optionId || '');
        }
        return;
      }

      // 箭头键导航
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      }

      // 回车键选择
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex < options.length) {
          handleDialogSelect(options[focusedIndex].optionId || '');
        }
      }

      // ESC 键取消
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDialogClose();
      }
    },
    [dialogs, focusedIndex],
  );

  // 组件更新：动态添加/移除键盘监听
  useEffect(() => {
    if (dialogs.length > 0) {
      window.addEventListener('keydown', handleKeyboardNavigation);
      // 添加焦点
      if (containerRef.current) {
        containerRef.current.focus();
      }
    } else {
      window.removeEventListener('keydown', handleKeyboardNavigation);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, [dialogs.length, handleKeyboardNavigation]);

  // 处理用户选择
  const handleDialogSelect = useCallback(
    (_optionId: string) => {
      if (dialogs.length === 0) {
        return;
      }
      const requestId = dialogs[0].requestId;
      // 关闭对话框
      functionComponentDialogManager.removeDialog(requestId);
    },
    [dialogs],
  );

  // 处理对话框关闭
  const handleDialogClose = useCallback(() => {
    if (dialogs.length === 0) {
      return;
    }
    const requestId = dialogs[0].requestId;
    functionComponentDialogManager.removeDialog(requestId);
  }, [dialogs]);

  // 如果没有对话框，返回null
  if (dialogs.length === 0) {
    return null;
  }

  const currentDialog = dialogs[0];
  const params = currentDialog.params;
  const smartTitle = getSmartTitle(params);
  const shouldShowDescription =
    ['edit', 'write', 'read', 'execute', 'bash'].includes(params.kind || '') && params.content;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        zIndex: 1000,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
      }}
    >
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          border: '1px solid var(--kt-popover-border-color, var(--popover-border-color))',
          boxShadow: 'var(--kt-popover-shadow, 0 4px 12px rgba(0, 0, 0, 0.15))',
          padding: '8px',
          outline: 'none',
          backgroundColor: 'var(--kt-popover-background, var(--popover-background, var(--app-background))',
          maxHeight: '200px',
          overflowY: 'auto',
          marginLeft: 8,
          marginRight: 8,
          width: 'calc(100% - 16px)',
        }}
        tabIndex={0}
      >
        {/* 头部：标题和关闭按钮 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: shouldShowDescription ? 6 : 0,
          }}
        >
          <div
            style={{
              fontSize: '0.9em',
              color: 'var(--app-primary-foreground)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: 'var(--app-primary, #0066cc)',
                color: '#fff',
                fontSize: '10px',
              }}
            >
              !
            </span>
            {smartTitle}
          </div>
          <button
            onClick={handleDialogClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--app-secondary-foreground)',
            }}
          >
            <span className={getIcon('close')} style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* 描述内容 */}
        {shouldShowDescription && params.content && (
          <div
            style={{
              fontSize: '0.8em',
              color: 'var(--app-secondary-foreground)',
              marginBottom: 8,
              fontFamily: 'monospace',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '80px',
              overflowY: 'auto',
              padding: '6px 8px',
              backgroundColor: 'var(--app-input-background)',
              borderRadius: 4,
            }}
          >
            {params.content}
          </div>
        )}

        {/* 选项按钮 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(params.options || []).map((option, index) => {
            const isFocused = focusedIndex === index;
            const buttonStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              textAlign: 'left',
              width: '100%',
              border: 0,
              borderRadius: 4,
              fontSize: '0.85em',
              fontWeight: isFocused ? 600 : 'normal',
              cursor: 'pointer',
              backgroundColor: isFocused ? 'var(--app-list-active-background)' : 'transparent',
              color: isFocused ? 'var(--app-list-active-foreground)' : 'var(--app-primary-foreground)',
              outline: 'none',
              transition: 'background-color 0.15s',
            };

            return (
              <button
                key={option.optionId}
                style={buttonStyle}
                onClick={() => handleDialogSelect(option.optionId || '')}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {/* 数字徽章 */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: isFocused ? 'var(--app-primary)' : 'var(--app-input-border)',
                    color: isFocused ? '#fff' : 'var(--app-secondary-foreground)',
                    fontSize: '0.8em',
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </span>
                <span>{option.name || option.optionId}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AcpPermissionDialogContainer;
export { PermissionDialogManager };
