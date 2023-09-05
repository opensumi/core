import { Schemes, URI, useInjectable } from '@opensumi/ide-core-browser';
import { getSimpleEditorOptions, ICodeEditor } from '@opensumi/ide-editor';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import React from 'react';

export const ChatEditor = ({ input }) => {
  input = `以下是使用 JavaScript 生成质数的示例代码：

  javascript
  function generatePrimeNumbers(n) {
    var primes = [];
    
    for (var i = 2; primes.length < n; i++) {
      if (isPrime(i)) {
        primes.push(i);
      }
    }
    
    return primes;
  }
  
  function isPrime(num) {
    for (var i = 2, sqrt = Math.sqrt(num); i <= sqrt; i++) {
      if (num % i === 0) {
        return false;
      }
    }
    
    return num > 1;
  }
  
  var n = 10; // 生成前10个质数
  var primeNumbers = generatePrimeNumbers(n);
  console.log(primeNumbers);
  `;

  const ref = React.useRef<HTMLDivElement | null>(null);
  const editorCollectionService = useInjectable<EditorCollectionService>(EditorCollectionService);
  const documentService = useInjectable<IEditorDocumentModelService>(IEditorDocumentModelService);

  const createEditor = async (container: HTMLElement): Promise<ICodeEditor> => {
    const codeEditor: ICodeEditor = await editorCollectionService.createCodeEditor(container!, {
      ...getSimpleEditorOptions(),
      lineHeight: 21,
      scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        handleMouseWheel: false,
      },
      acceptSuggestionOnEnter: 'on',
      renderIndentGuides: false,
    });

    const docModel = await documentService.createModelReference(
      new URI(`ai/chat/editor`).withScheme(Schemes.walkThroughSnippet),
    );

    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    codeEditor.monacoEditor.setModel(model);

    return codeEditor;
  }

  React.useEffect(() => {
    if (ref && ref.current) {
      createEditor(ref.current).then((codeEditor) => {
        if (codeEditor) {
          codeEditor.monacoEditor.setValue(input)
          codeEditor.monacoEditor.getContentHeight
        }
      });
    }
  }, [ref.current]);

  return (
    <div ref={ref}></div>
  )
}