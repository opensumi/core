// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// based on https://github.com/microsoft/inshellisense/blob/ef837d4f738533da7e1a3845231bd5965e025bf1/src/runtime/model.ts

export interface Suggestion {
  name: string;
  allNames: string[];
  description?: string;
  icon: string;
  priority: number;
  insertValue?: string;
  pathy?: boolean;
}

export interface SuggestionBlob {
  suggestions: Suggestion[];
  argumentDescription?: string;
  charactersToDrop?: number;
}
