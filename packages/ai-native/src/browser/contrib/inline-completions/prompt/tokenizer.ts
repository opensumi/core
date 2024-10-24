import { Tiktoken, get_encoding } from 'tiktoken';

import { TokenizerName } from '../types';

const TOKENIZER_CACHE = new Map<TokenizerName, Tiktoken>();

export const getTokenizer = (tokenizerName = TokenizerName.cl100k_base) => {
  let tokenizer = TOKENIZER_CACHE.get(tokenizerName);
  if (tokenizer) {
    return tokenizer;
  }
  tokenizer = get_encoding('cl100k_base');
  TOKENIZER_CACHE.set(tokenizerName, tokenizer);
  return tokenizer;
};
