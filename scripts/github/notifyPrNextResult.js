const { createVersionText } = require('./helpers');

module.exports = async ({ github, context, core }) => {
  const commentBody = createVersionText('PR Next', process.env.CURRENT_VERSION);

  github.rest.issues.createComment({
    issue_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
    body: commentBody,
  });

  github.checks.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    status: 'completed',
    completed_at: new Date(),
    conclusion: 'success',
    check_run_id: process.env.CHECK_RUN_ID,
    output: {
      title: 'PR Next Version publish successful!',
      summary: `A version for pull request is **published**. version: **${process.env.CURRENT_VERSION}**`,
    },
  });
};
