// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface Suggestion  {
  name: string;
  allNames: string[];
  description?: string;
  icon: string;
  priority: number;
  insertValue?: string;
  pathy?: boolean;
};

export interface SuggestionBlob {
  suggestions: Suggestion[];
  argumentDescription?: string;
  charactersToDrop?: number;
};
