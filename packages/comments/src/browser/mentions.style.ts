const lineHeight = 20;

export const getMentionBoxStyle = ({ maxRows = 10, minRows = 2 }) => ({
  control: {
    fontSize: 12,
  },

  highlighter: {
    overflow: 'hidden',
  },

  input: {
    margin: 0,
  },

  '&multiLine': {
    control: {
      border: 'none',
    },

    highlighter: {
      padding: 9,
    },

    input: {
      boxSizing: 'content-box',
      padding: '8px 0',
      lineHeight: `${lineHeight}px`,
      minHeight: `${lineHeight * minRows}px`,
      maxHeight: `${lineHeight * maxRows}px`,
      outline: 0,
      border: 0,
      overflowY: 'auto',
    },
  },

  suggestions: {
    dataA: 'aaa',
    list: {
      backgroundColor: 'var(--kt-selectDropdown-background)',
      fontSize: 12,
      maxHeight: 200,
      overflowY: 'auto',
    },

    item: {
      backgroundColor: 'var(--kt-selectDropdown-background)',
      color: 'var(--kt-selectDropdown-foreground)',
      padding: '4px 16px',
      '&focused': {
        backgroundColor: 'var(--kt-selectDropdown-selectionBackground)',
      },
    },
  },
});
