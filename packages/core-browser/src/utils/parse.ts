
export interface LabelIcon {
  name: string;
  animation?: string;
}

export namespace LabelIcon {
  export function is(val: object): val is LabelIcon {
      return 'name' in val;
  }
}

export type LabelPart = string | LabelIcon;

export function parseLabel(text: string): LabelPart[] {
  const parserArray: LabelPart[] = [];
  let arrPointer = 0;
  let potentialIcon = '';

  for (let idx = 0; idx < text.length; idx++) {
      const char = text.charAt(idx);
      parserArray[arrPointer] = parserArray[arrPointer] || '';
      if (potentialIcon === '') {
          if (char === '$') {
              potentialIcon += char;
          } else {
              parserArray[arrPointer] += char;
          }
      } else if (potentialIcon === '$') {
          if (char === '(') {
              potentialIcon += char;
          } else {
              parserArray[arrPointer] += potentialIcon + char;
              potentialIcon = '';
          }
      } else {
          if (char === ')') {
              const iconClassArr = potentialIcon.substring(2, potentialIcon.length).split('~');
              if (parserArray[arrPointer] !== '') {
                  arrPointer++;
              }
              parserArray[arrPointer] = { name: iconClassArr[0], animation: iconClassArr[1] };
              arrPointer++;
              potentialIcon = '';
          } else {
              potentialIcon += char;
          }
      }
  }

  if (potentialIcon !== '') {
      parserArray[arrPointer] += potentialIcon;
  }

  return parserArray;
}
