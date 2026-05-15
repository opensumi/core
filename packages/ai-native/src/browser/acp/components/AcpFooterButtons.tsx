import cls from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { ChatFeatureRegistryToken } from '@opensumi/ide-core-common';

import { ChatFeatureRegistry } from '../../chat/chat.feature.registry';
import styles from '../../components/components.module.less';

export function AcpSlashCommandFooter() {
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slashCommands = useMemo(() => chatFeatureRegistry.getAllSlashCommand(), [chatFeatureRegistry]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isOpen]);

  const handleSelectCommand = useCallback(
    (command: { nameWithSlash: string; icon?: string; name?: string; description?: string }) => {
      window.dispatchEvent(
        new CustomEvent('opensumi-chat-input-insert-slash', {
          detail: { nameWithSlash: command.nameWithSlash },
        }),
      );
      setIsOpen(false);
    },
    [],
  );

  if (slashCommands.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.slash_command_container}>
      <span className={styles.slash_command_trigger} onClick={() => setIsOpen(!isOpen)}>
        /
      </span>
      {isOpen && (
        <div className={styles.slash_command_dropdown}>
          <ul>
            {slashCommands.map(({ icon, nameWithSlash, name, description }) => (
              <li
                key={name}
                className={cls(styles.block, styles.dropdown_block)}
                onClick={() => handleSelectCommand({ nameWithSlash, icon, name, description })}
              >
                {icon && <EnhanceIcon className={icon} />}
                {nameWithSlash && <span className={styles.name}>{nameWithSlash}</span>}
                {description && <span className={styles.text}>{description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
