export abstract class BasePromptManager {
  protected promptHasSpace(str: string) {
    const pattern = /^\s*/;
    const match = str.match(pattern);

    return match ? match[0].length : 0;
  }

  protected isCodeBlockLine(text: string) {
    return /^\s*```/.test(text);
  }

  protected removeExtraSpace(prompt: string) {
    const promptArray = prompt.split('\n');
    // remove empty line
    while (!promptArray[0].length) {
      promptArray.shift();
    }

    if (this.promptHasSpace(promptArray[0])) {
      let isCodeBlock = false;
      for (let i = 0; i < promptArray.length; i++) {
        if (isCodeBlock && !this.isCodeBlockLine(promptArray[i])) {
          continue;
        }

        if (this.isCodeBlockLine(promptArray[i])) {
          isCodeBlock = !isCodeBlock;
          // some special case e.g.: ```java\n  import
          promptArray[i + 1] = promptArray[i + 1].replace(/^\s+/, '');
        }
        // remove space
        promptArray[i] = promptArray[i].replace(/^\s+/, '');
      }
    }

    return promptArray.join('\n');
  }
}
