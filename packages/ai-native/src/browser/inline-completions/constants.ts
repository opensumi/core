interface ICompletionModel {
  completionPromptMaxLineSize: number;
  completionSuffixMaxLineSize: number;
}

export const completionModel: ICompletionModel = {
  completionPromptMaxLineSize: 1024,
  completionSuffixMaxLineSize: 500,
};
