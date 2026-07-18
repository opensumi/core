# Issue tracker: Local Markdown

Issues and PRDs for this repository live only as local Markdown files under `.scratch/`. Do not publish, mirror, or synchronize issue content to GitHub, GitLab, Dima, or another remote issue tracker.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append under a `## Comments` heading

## Skill operations

- Publishing an issue or PRD means creating or updating the corresponding local Markdown file.
- Fetching a ticket means reading the referenced local Markdown file.
- No remote issue-tracker mutation is permitted.
