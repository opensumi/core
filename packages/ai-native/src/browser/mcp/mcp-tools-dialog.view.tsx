import * as React from 'react';

import { MCPTool } from '../../common/types';

import styles from './mcp-tools-dialog.module.less';

interface MCPToolsDialogProps {
  tools: MCPTool[];
}

export const MCPToolsDialog: React.FC<MCPToolsDialogProps> = ({ tools }) => (
  <div className={styles.mcp_tools_dialog}>
    <div className={styles.dialog_title}>MCP Tools</div>
    <div className={styles.tools_list}>
      {tools.map((tool) => (
        <div key={tool.name} className={styles.tool_item}>
          <div className={styles.tool_name}>{tool.name}</div>
          <div className={styles.tool_description}>{tool.description}</div>
          {tool.providerName && <div className={styles.tool_provider}>Provider: {tool.providerName}</div>}
        </div>
      ))}
    </div>
  </div>
);
