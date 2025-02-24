import React from 'react';

import { Button } from '@opensumi/ide-components/lib/button';
import { Modal } from '@opensumi/ide-components/lib/modal';

import styles from './mcp-server-form.module.less';

export interface MCPServerFormData {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface Props {
  visible: boolean;
  initialData?: MCPServerFormData;
  onSave: (data: MCPServerFormData) => void;
  onCancel: () => void;
}

export const MCPServerForm: React.FC<Props> = ({ visible, initialData, onSave, onCancel }) => {
  const [formData, setFormData] = React.useState<MCPServerFormData>(() => ({
    name: '',
    command: '',
    args: [],
    env: {},
    type: 'stdio', // TODO: 支持 SSE
    ...initialData,
  }));

  const [argsText, setArgsText] = React.useState(() => initialData?.args?.join(' ') || '');
  const [envText, setEnvText] = React.useState(() => {
    if (!initialData?.env) {
      return '';
    }
    return Object.entries(initialData.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  });

  // Update form data when initialData changes
  React.useEffect(() => {
    setFormData({
      name: '',
      command: '',
      args: [],
      env: {},
      ...initialData,
    });
    setArgsText(initialData?.args?.join(' ') || '');
    setEnvText(
      initialData?.env
        ? Object.entries(initialData.env)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n')
        : '',
    );
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const args = argsText.split(' ').filter(Boolean);
    const env = envText
      .split('\n')
      .filter(Boolean)
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {} as Record<string, string>);

    onSave({
      ...formData,
      args,
      env,
    });
  };

  return (
    <Modal
      title={initialData ? 'Edit MCP Server' : 'Add New MCP Server'}
      visible={visible}
      onCancel={onCancel}
      centered
      width={600}
      footer={null}
      style={{
        background: 'var(--editor-background)',
      }}
    >
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.formItem}>
          <label>Name:</label>
          <input
            type='text'
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder='Enter server name'
            required
          />
        </div>
        <div className={styles.formItem}>
          <label>Command:</label>
          <input
            type='text'
            value={formData.command}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            placeholder='Enter command (e.g., npx)'
            required
          />
        </div>
        <div className={styles.formItem}>
          <label>Arguments:</label>
          <textarea
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            placeholder='Enter arguments separated by space'
            rows={3}
          />
        </div>
        <div className={styles.formItem}>
          <label>Environment Variables:</label>
          <textarea
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder='KEY=value (one per line)'
            rows={3}
          />
        </div>
        <div className={styles.formActions}>
          <Button onClick={onCancel} type='secondary'>
            Cancel
          </Button>
          <Button onClick={handleSubmit} type='primary'>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};
