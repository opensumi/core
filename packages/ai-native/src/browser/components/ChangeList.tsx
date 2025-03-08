import React, { useMemo, useState } from 'react';

import { Icon } from '@opensumi/ide-components';
import { LabelService, URI, useInjectable } from '@opensumi/ide-core-browser';

import { CodeBlockStatus } from '../../common/types';

import { renderStatus } from './ApplyStatus';
import styles from './change-list.module.less';

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status: CodeBlockStatus;
}

interface FileListDisplayProps {
  files: FileChange[];
  onFileClick: (path: string) => void;
}

export const FileListDisplay: React.FC<FileListDisplayProps> = ({ files, onFileClick }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const labelService = useInjectable<LabelService>(LabelService);
  const fileIcons = useMemo(
    () =>
      files.map((file) => {
        const uri = URI.parse(file.path);
        const iconClass = labelService.getIcon(uri);
        return <span className={iconClass}></span>;
      }),
    [files],
  );

  const totalFiles = files.length;
  const totalChanges = files.reduce(
    (acc, file) => ({
      additions: acc.additions + file.additions,
      deletions: acc.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const renderChangeStats = (additions: number, deletions: number) => {
    const parts: React.ReactNode[] = [];

    if (additions > 0) {
      parts.push(
        <span key='add' className={styles.additions}>
          +{additions}
        </span>,
      );
    }

    if (deletions > 0) {
      if (parts.length > 0) {
        parts.push(' ');
      }
      parts.push(
        <span key='del' className={styles.deletions}>
          -{deletions}
        </span>,
      );
    }

    if (parts.length === 0) {
      parts.push(
        <span key='no-change' className={styles.noChange}>
          No changes
        </span>,
      );
    }

    return parts;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={handleToggle}>
        <button className={styles.toggleButton}>{isExpanded ? <Icon icon='down' /> : <Icon icon='right' />}</button>
        <span className={styles.title}>
          Changed Files ({totalFiles}) {renderChangeStats(totalChanges.additions, totalChanges.deletions)}
        </span>
      </div>

      <ul className={`${styles.fileList} ${!isExpanded ? styles.collapsed : ''}`}>
        {files.map((file, index) => (
          <li key={index} className={styles.fileItem} onClick={() => onFileClick(file.path)}>
            <span className={styles.fileIcon}>{fileIcons[index] || '📄'}</span>
            <div className={styles.fileInfo}>
              <div className={styles.filePath}>{file.path}</div>
              <div className={styles.fileStats}>{renderChangeStats(file.additions, file.deletions)}</div>
              {renderStatus(file.status)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
