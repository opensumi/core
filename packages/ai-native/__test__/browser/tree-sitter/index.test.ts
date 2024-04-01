import { LanguageParser } from '@opensumi/ide-ai-native/lib/browser/languages/parser';

describe('tree sitter', () => {
  it('parser', async () => {
    const parser = LanguageParser.fromLanguageId('javascript');
    expect(parser).toBeDefined();

    await parser!.ready();
  });
});
