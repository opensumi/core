import cls from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { ClickOutside } from '@opensumi/ide-components/lib/click-outside';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';

import styles from './mention-select.module.less';

export interface ExtendedModelOption {
  label: string;
  value: string;
  icon?: string;
  iconClass?: string;
  tags?: string[];
  features?: string[];
  description?: string;
  disabled?: boolean;
  badge?: string;
  badgeColor?: string;
  selected?: boolean;
}

export interface MentionSelectProps {
  options: ExtendedModelOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  showThinking?: boolean;
  thinkingEnabled?: boolean;
  onThinkingChange?: (enabled: boolean) => void;
}

const ThinkingToggle: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ enabled, onChange }) => (
  <div className={styles.thinking_toggle} onClick={() => onChange(!enabled)}>
    <Icon
      iconClass={getIcon(enabled ? 'check' : 'circle-outline')}
      className={cls(styles.thinking_icon, {
        [styles.enabled]: enabled,
      })}
    />
    <span className={styles.thinking_label}>Thinking</span>
  </div>
);

export const MentionSelect: React.FC<MentionSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  size = 'small',
  showThinking = false,
  thinkingEnabled = false,
  onThinkingChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>('up');
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.selected) || options.find((option) => option.value === value);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setActiveIndex(-1);
    }
  };

  const handleSelect = (option: ExtendedModelOption) => {
    if (!option.disabled) {
      onChange?.(option.value);
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {
      return;
    }

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (activeIndex >= 0) {
          handleSelect(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
    }
  };

  const handleClickOutside = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    if (isOpen && selectRef.current) {
      const selectRect = selectRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = Math.min(400, options.length * 60);

      const spaceAbove = selectRect.top;
      const spaceBelow = viewportHeight - selectRect.bottom;

      if (spaceAbove < dropdownHeight && spaceBelow > spaceAbove) {
        setDropdownDirection('down');
      } else {
        setDropdownDirection('up');
      }
    }
  }, [isOpen, options.length]);

  useEffect(() => {
    if (isOpen && activeIndex >= 0 && dropdownRef.current) {
      const activeElement = dropdownRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [isOpen, activeIndex]);

  return (
    <ClickOutside onOutsideClick={handleClickOutside}>
      <div
        ref={selectRef}
        className={cls(
          styles.mention_select,
          styles[`size_${size}`],
          {
            [styles.disabled]: disabled,
            [styles.open]: isOpen,
            [styles.dropdown_up]: dropdownDirection === 'up',
            [styles.dropdown_down]: dropdownDirection === 'down',
          },
          className,
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role='combobox'
        aria-expanded={isOpen}
        aria-haspopup='listbox'
      >
        <div className={styles.select_trigger}>
          <div className={styles.select_content}>
            {selectedOption ? (
              <div className={styles.selected_option}>
                <span className={styles.option_label}>{selectedOption.label}</span>
                {selectedOption.badge && (
                  <span className={styles.option_badge} style={{ backgroundColor: selectedOption.badgeColor }}>
                    {selectedOption.badge}
                  </span>
                )}
              </div>
            ) : (
              <span className={styles.placeholder}>{placeholder}</span>
            )}
          </div>
          <Icon
            iconClass={getIcon('down-arrow')}
            className={cls(styles.dropdown_arrow, {
              [styles.open]: isOpen,
            })}
          />
        </div>

        {isOpen && (
          <div ref={dropdownRef} className={styles.dropdown} role='listbox'>
            {showThinking && onThinkingChange && (
              <div className={styles.thinking_section}>
                <ThinkingToggle enabled={thinkingEnabled} onChange={onThinkingChange} />
                <div className={styles.divider} />
              </div>
            )}

            {options.map((option, index) => (
              <div
                key={option.value}
                className={cls(styles.option, {
                  [styles.active]: index === activeIndex,
                  [styles.selected]: option.selected || option.value === value,
                  [styles.disabled]: option.disabled,
                })}
                onClick={() => handleSelect(option)}
                role='option'
                aria-selected={option.selected || option.value === value}
              >
                <div className={styles.option_main}>
                  <div className={styles.option_header}>
                    <div className={styles.option_title}>
                      {option.icon && <Icon icon={option.icon} className={styles.option_icon} />}
                      {option.iconClass && <Icon iconClass={option.iconClass} className={styles.option_icon} />}
                      <span className={styles.option_label}>{option.label}</span>
                      {option.badge && (
                        <span className={styles.option_badge} style={{ backgroundColor: option.badgeColor }}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {option.description && <div className={styles.option_description}>{option.description}</div>}

                  {option.tags && option.tags.length > 0 && (
                    <div className={styles.option_tags}>
                      {option.tags.map((tag, idx) => (
                        <span key={idx} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClickOutside>
  );
};
