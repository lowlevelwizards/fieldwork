# 21 — AI V2 Continuous Integration

The repository's dependency-free Node checks now run in GitHub Actions on pull requests targeting `AI-2.0` and on direct updates to that branch.

The workflow executes only:

```bash
npm test
```

That command remains the single committed contract for:

- syntax validation;
- import resolution;
- cycle detection;
- retired duplicate detection;
- deterministic AI V2 regressions;
- Legacy runtime isolation.

The workflow does not deploy, mutate release state, or introduce a second test command.
