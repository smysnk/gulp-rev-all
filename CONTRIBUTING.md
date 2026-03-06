# Contributing

Thanks for contributing to `gulp-rev-all`.

## Before You Start

- Use Node.js `>=18.18`, which matches the package engine requirement.
- Check existing [issues](https://github.com/smysnk/gulp-rev-all/issues) before starting work.
- For larger changes, behavior changes, or breaking changes, open an issue first so the approach can be discussed before implementation.

## Local Setup

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Run the full project checks:

   ```sh
   npm test
   ```

Useful commands during development:

```sh
npm run build
npm run lint
npm run test:unit
```

## Project Layout

- `src/` contains the TypeScript source.
- `dist/` contains generated build output and declaration files.
- `test.js` contains the unit test suite.
- `test/fixtures/` contains fixture files used by the tests.

Do not edit files in `dist/` by hand. Update the TypeScript source in `src/` and regenerate build output with `npm run build`.

## Change Guidelines

- Keep pull requests focused and small when possible.
- Preserve existing runtime behavior unless the change is intentional and documented.
- Add or update tests for bug fixes and behavior changes.
- Update documentation when changing the public API, package options, or generated types.
- Follow the existing code style and keep lint and tests passing before opening a pull request.

## Pull Requests

When opening a pull request:

- Explain the problem and the chosen approach clearly.
- Link the related issue when one exists.
- Mention any behavior changes, edge cases, or migration impact.
- Include test coverage for the change.

## Code of Conduct

By participating in this project, you agree to follow the guidelines in [CODE_OF_CONDUCT.md](/Users/josh/play/oss/gulp-rev-all/CODE_OF_CONDUCT.md).
