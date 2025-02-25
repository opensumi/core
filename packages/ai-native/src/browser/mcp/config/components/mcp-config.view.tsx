import React from 'react';

import { AINativeSettingSectionsId, ILogger, useInjectable } from '@opensumi/ide-core-browser';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences';

import { BUILTIN_MCP_SERVER_NAME } from '../../../../common';
import { MCPServerDescription } from '../../../../common/mcp-server-manager';
import { MCPServerProxyService } from '../../mcp-server-proxy.service';

import styles from './mcp-config.module.less';
import { MCPServerForm, MCPServerFormData } from './mcp-server-form';

interface MCPServer {
  name: string;
  isStarted: boolean;
  tools?: string[];
  command?: string;
  type?: string;
}

export const MCPConfigView: React.FC = () => {
  const mcpServerProxyService = useInjectable<MCPServerProxyService>(MCPServerProxyService);
  const preferenceService = useInjectable<PreferenceService>(PreferenceService);
  const logger = useInjectable<ILogger>(ILogger);
  const [servers, setServers] = React.useState<MCPServer[]>([]);
  const [formVisible, setFormVisible] = React.useState(false);
  const [editingServer, setEditingServer] = React.useState<MCPServerFormData | undefined>();

  const loadServers = React.useCallback(async () => {
    const allServers = await mcpServerProxyService.$getServers();
    setServers(allServers);
  }, [mcpServerProxyService]);

  React.useEffect(() => {
    loadServers();
    const disposer = mcpServerProxyService.onChangeMCPServers(() => {
      loadServers();
    });

    return () => {
      disposer.dispose();
    };
  }, [mcpServerProxyService, loadServers]);

  const handleServerControl = async (serverName: string, start: boolean) => {
    try {
      if (start) {
        await mcpServerProxyService.$startServer(serverName);
      } else {
        await mcpServerProxyService.$stopServer(serverName);
      }

      // Update enabled state in preferences
      const servers = preferenceService.get<MCPServerDescription[]>(AINativeSettingSectionsId.MCPServers, []);
      let updatedServers = servers;

      // 处理内置服务器的特殊情况
      if (serverName === BUILTIN_MCP_SERVER_NAME) {
        const builtinServerExists = servers.some((server) => server.name === BUILTIN_MCP_SERVER_NAME);
        if (!builtinServerExists && !start) {
          // 如果是停止内置服务器且之前没有配置，添加一个新的配置项
          // 内置服务器不需要 command，因为它是直接集成在 IDE 中的
          updatedServers = [
            ...servers,
            {
              name: BUILTIN_MCP_SERVER_NAME,
              enabled: false,
              command: '', // 内置服务器的 command 为空字符串
            },
          ];
        } else {
          // 如果已经存在配置，更新 enabled 状态
          updatedServers = servers.map((server) => {
            if (server.name === BUILTIN_MCP_SERVER_NAME) {
              return { ...server, enabled: start };
            }
            return server;
          });
        }
      } else {
        // 处理其他外部服务器
        updatedServers = servers.map((server) => {
          if (server.name === serverName) {
            return { ...server, enabled: start };
          }
          return server;
        });
      }

      await preferenceService.set(AINativeSettingSectionsId.MCPServers, updatedServers);
      await loadServers();
    } catch (error) {
      logger.error(`Failed to ${start ? 'start' : 'stop'} server ${serverName}:`, error);
    }
  };

  const handleAddServer = () => {
    setEditingServer(undefined);
    setFormVisible(true);
  };

  const handleEditServer = (server: MCPServer) => {
    const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
    const serverConfig = servers.find((s) => s.name === server.name);

    if (serverConfig) {
      setEditingServer(serverConfig);
      setFormVisible(true);
    }
  };

  const handleDeleteServer = async (serverName: string) => {
    const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
    const updatedServers = servers.filter((s) => s.name !== serverName);
    await preferenceService.set(AINativeSettingSectionsId.MCPServers, updatedServers);
    await loadServers();
  };

  const handleSaveServer = async (data: MCPServerFormData) => {
    const servers = preferenceService.get<MCPServerFormData[]>(AINativeSettingSectionsId.MCPServers, []);
    const existingIndex = servers.findIndex((s) => s.name === data.name);

    if (existingIndex >= 0) {
      servers[existingIndex] = data;
    } else {
      servers.push(data);
    }

    await preferenceService.set(AINativeSettingSectionsId.MCPServers, servers);
    setFormVisible(false);
    await loadServers();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>MCP Servers</h2>
          <p className={styles.description}>Manage your MCP server connections.</p>
        </div>
        <button className={styles.addButton} onClick={handleAddServer}>
          + Add new MCP server
        </button>
      </div>
      <div className={styles.serversList}>
        {servers.map((server) => (
          <div key={server.name} className={styles.serverItem}>
            <div className={styles.serverHeader}>
              <div className={styles.serverTitleRow}>
                <h3 className={styles.serverName}>{server.name}</h3>
              </div>
              <div className={styles.serverActions}>
                <button className={styles.iconButton} title='Edit' onClick={() => handleEditServer(server)}>
                  <i className='codicon codicon-edit' />
                </button>
                <button
                  className={styles.iconButton}
                  title={server.isStarted ? 'Stop' : 'Start'}
                  onClick={() => handleServerControl(server.name, !server.isStarted)}
                >
                  <i className={`codicon ${server.isStarted ? 'codicon-debug-stop' : 'codicon-debug-start'}`} />
                </button>
                <button className={styles.iconButton} title='Delete' onClick={() => handleDeleteServer(server.name)}>
                  <i className='codicon codicon-trash' />
                </button>
              </div>
            </div>
            <div className={styles.serverDetail}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status:</span>
                <span className={`${styles.serverStatus} ${server.isStarted ? styles.running : styles.stopped}`}>
                  {server.isStarted ? 'Running' : 'Stopped'}
                </span>
              </div>
              {server.type && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Type:</span>
                  <span className={styles.serverType}>{server.type}</span>
                </div>
              )}
            </div>
            {server.tools && server.tools.length > 0 && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Tools:</span>
                  <span className={styles.detailContent}>
                    {server.tools.map((tool, index) => (
                      <span key={index} className={styles.toolTag}>
                        {tool}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            )}
            {server.command && (
              <div className={styles.serverDetail}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Command:</span>
                  <span className={styles.detailContent}>{server.command}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <MCPServerForm
        visible={formVisible}
        initialData={editingServer}
        onSave={handleSaveServer}
        onCancel={() => setFormVisible(false)}
      />
    </div>
  );
};
