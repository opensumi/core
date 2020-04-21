export const markdownCss = `
h1, h2, h3, h4, h5, h6, p {
  color: var(--foreground);
  word-break: break-all;
}
pre:last-child,
p:last-child {
  margin-bottom: 0;
}
pre {
  background-color: var(--textBlockQuote-background);
  border-color: var(--textBlockQuote-border);
}
img {
  max-width: 100%;
  max-height: 100%;
}
`;
