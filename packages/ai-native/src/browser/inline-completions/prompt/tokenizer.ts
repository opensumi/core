// @ts-ignore
import { Tiktoken, getEncoding } from 'js-tiktoken';

import { TokenizerName } from '../types';

const TOKENIZER_CACHE = new Map<TokenizerName, Tiktoken>();

export const getTokenizer = (tokenizerName = TokenizerName.cl100k_base) => {
  let tokenizer = TOKENIZER_CACHE.get(tokenizerName);
  if (tokenizer) {
    return tokenizer;
  }
  tokenizer = getEncoding('cl100k_base');
  TOKENIZER_CACHE.set(tokenizerName, tokenizer);
  return tokenizer;
};
