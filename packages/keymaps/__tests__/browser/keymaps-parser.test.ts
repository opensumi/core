import { KeymapsParser } from '../../src/browser/keymaps-parser';

describe('KeymapsParser should be work', () => {
  const parser = new KeymapsParser();
  it('well formatted raw text', async () => {
    await expectParsing(
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

  it('no array', async () => {
    await expectParsing(
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

  it('additional property', async () => {
    await expectParsing(
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

  it('wrong type', async () => {
    await expectParsing(
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

  it('missing property', async () => {
    await expectParsing(
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
  async function expectParsing(expectation: string, content: string): Promise<void> {
    const errors: string[] = [];
    const keybindings = await parser.parse(content, errors);
    expect(expectation).toBe(JSON.stringify({ keybindings, errors }, undefined, 2));
  }
});
