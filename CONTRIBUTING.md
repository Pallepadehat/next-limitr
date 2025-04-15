# Contributing to next-limitr

Thank you for considering contributing to next-limitr! This document provides guidelines and instructions to help you get started.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:

- A clear title and description
- Steps to reproduce the bug
- Expected and actual behavior
- Any relevant code snippets or error messages
- Your environment details (Node.js version, Next.js version, etc.)

### Suggesting Features

We welcome feature suggestions! Please create an issue with:

- A clear title and description
- The problem your feature would solve
- How your feature would work
- Any potential implementation details

### Pull Requests

1. Fork the repository
2. Create a new branch with a descriptive name (`feat/add-redis-support`, `fix/memory-leak`, etc.)
3. Make your changes
4. Add or update tests to cover your changes
5. Run the existing tests to ensure nothing else broke
6. Submit a pull request

### Development Setup

1. Clone your fork of the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Build the package:
   ```bash
   npm run build
   ```

## Style Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation when necessary

## Testing

All pull requests should include appropriate tests. Run the test suite with:

```bash
npm test
```

## Documentation

When adding new features, please update the README.md with appropriate documentation.

## Release Process

The maintainers will handle the release process, which includes:

1. Updating the version in package.json
2. Creating a new tag/release on GitHub
3. Publishing to npm

## Questions?

If you have any questions, feel free to open an issue or contact the maintainers.

Thank you for contributing to next-limitr!
