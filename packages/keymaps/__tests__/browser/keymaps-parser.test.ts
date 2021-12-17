import { KeymapsParser } from '../../src/browser/keymaps-parser';

describe('KeymapsParser should be work', () => {
  const parser = new KeymapsParser();
  it('well formatted raw text', () => {
    expectParsing(
      `{
  "keybindings": [
    {
      "keybinding": "ctrl+p",
      "command": "command1"
    },
    {
      "keybinding": "ctrl+shift+p",
      "command": "command2"
    }
  ],
  "errors": []
}`,
      `[
    {
        "keybinding": "ctrl+p",
        "command": "command1"
    },
    {
        "keybinding": "ctrl+shift+p",
        "command": "command2"
    }
]`,
    );
  });

  it('no array', () => {
    expectParsing(
      `{
  "keybindings": [],
  "errors": [
    "should be array at "
  ]
}`,
      `{
    "keybinding": "ctrl+p",
    "command": "command"
}`,
    );
  });

  it('additional property', () => {
    expectParsing(
      `{
  "keybindings": [],
  "errors": [
    "should NOT have additional properties at /0"
  ]
}`,
      `[
    {
        "keybinding": "ctrl+p",
        "command": "command",
        "extra": 0
    }
]`,
    );
  });

  it('wrong type', () => {
    expectParsing(
      `{
  "keybindings": [],
  "errors": [
    "should be string at /0/keybinding"
  ]
}`,
      `[
    {
        "keybinding": 0,
        "command": "command1"
    },
    {
        "keybinding": "ctrl+shift+p",
        "command": 0
    }
]`,
    );
  });

  it('missing property', () => {
    expectParsing(
      `{
  "keybindings": [],
  "errors": [
    "PropertyNameExpected at 44 offset of 1 length",
    "ValueExpected at 44 offset of 1 length",
    "should have required property 'command' at /0"
  ]
}`,
      `[
    {
        "keybinding": "ctrl+p",
    }
]`,
    );
  });

  /**
   * 断言该内容等于预期的内容。
   * @param {string} expectation
   * @param {string} content
   */
  function expectParsing(expectation: string, content: string): void {
    const errors: string[] = [];
    const keybindings = parser.parse(content, errors);
    expect(expectation).toBe(JSON.stringify({ keybindings, errors }, undefined, 2));
  }
});
