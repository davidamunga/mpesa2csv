# Contributing to mpesa2csv

Thank you for your interest in contributing to mpesa2csv! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Respect different viewpoints and experiences

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/DavidAmunga/mpesa2csv.git
   cd mpesa2csv/app
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/DavidAmunga/mpesa2csv.git
   ```

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://www.rust-lang.org/tools/install) (v1.70 or newer)
- [pnpm](https://pnpm.io/) (v8 or newer)
- [Tauri CLI](https://tauri.app/v1/api/cli/)

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Tauri CLI (if not already installed):
   ```bash
   cargo install tauri-cli
   ```

3. Run the development server:
   ```bash
   pnpm run tauri dev
   ```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Help us identify and fix issues
- **Feature enhancements**: Add new functionality or improve existing features
- **Documentation**: Improve documentation, add examples, or fix typos
- **Performance improvements**: Optimize code for better performance
- **UI/UX improvements**: Enhance the user interface and experience
- **Testing**: Add or improve test coverage

### Before You Start

1. Check existing [issues](https://github.com/DavidAmunga/mpesa2csv/issues) and [pull requests](https://github.com/DavidAmunga/mpesa2csv/pulls)
2. Create an issue to discuss major changes before implementing
3. Ensure your contribution aligns with the project's goals

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow the [code style guidelines](#code-style)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   # Run the development server
   pnpm run tauri dev
   
   # Build for production to ensure it compiles
   pnpm run tauri build
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**:
   - Use the provided PR template
   - Provide a clear description of your changes
   - Link any related issues
   - Add screenshots for UI changes

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: add Excel export functionality
fix: resolve PDF password handling issue
docs: update installation instructions
style: format code with prettier
```

## Issue Reporting

When reporting issues, please include:

1. **Clear title**: Briefly describe the issue
2. **Description**: Detailed explanation of the problem
3. **Steps to reproduce**: Step-by-step instructions
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Environment**:
   - OS and version
   - Node.js version
   - pnpm version
   - App version
7. **Screenshots**: If applicable
8. **Additional context**: Any other relevant information

### Issue Templates

Use these labels when creating issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed

## Development Workflow

### Project Structure

```
app/
├── src/                    # React frontend source
│   ├── components/         # React components
│   ├── services/          # Business logic and services
│   └── App.tsx            # Main application component
├── src-tauri/             # Tauri backend source
│   ├── src/               # Rust source code
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
├── dist/                  # Built frontend files
└── package.json           # Node.js dependencies
```

### Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Tauri (Rust)
- **PDF Processing**: PDF.js
- **CSV Generation**: PapaParse
- **Excel Generation**: xlsx
- **Build Tool**: Vite
- **Package Manager**: pnpm

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Prefer functional components and hooks

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript interfaces for props
- Follow the existing component structure

### Rust Code

- Follow standard Rust conventions
- Use `cargo fmt` to format code
- Use `cargo clippy` for linting
- Add documentation for public functions

### CSS/Styling

- Use Tailwind CSS utility classes
- Follow the existing design patterns
- Ensure responsive design
- Test on different screen sizes

## Testing

### Frontend Testing

Currently, the project doesn't have extensive test coverage. Contributions to improve testing are welcome:

- Manual testing of UI components
- Testing PDF parsing functionality
- Testing CSV/Excel export features

### Manual Testing Checklist

Before submitting a PR, please test:

- [ ] Application starts without errors
- [ ] PDF file selection works
- [ ] Password-protected PDF handling
- [ ] CSV export functionality
- [ ] Excel export functionality (if applicable)
- [ ] UI responsiveness
- [ ] Error handling

### Platform Testing

Test on your platform and mention it in your PR:

- **Windows**: Test with Windows 10/11
- **macOS**: Test with recent macOS versions (Intel and Apple Silicon if possible)
- **Linux**: Test with popular distributions (Ubuntu, Fedora, etc.)

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management:

1. **Add a changeset** for your changes:
   ```bash
   pnpm changeset
   ```

2. **Write a user-facing summary** — this becomes the changelog and GitHub release notes.
   Prefer a complete sentence that explains the outcome for users, not a commit subject:

   - Good: `Fix password-protected PDFs failing instead of showing the unlock prompt.`
   - Avoid: `fix: password stuff` or thanking yourself in the summary

3. **Commit the changeset** with your PR

The maintainers will handle the release process, which includes:

- Version bumping
- Changelog generation
- GitHub releases
- Binary distribution

## Getting Help

If you need help or have questions:

1. Check the [existing documentation](README.md)
2. Look through [existing issues](https://github.com/DavidAmunga/mpesa2csv/issues)
3. Create a new issue with the `question` label
4. Join discussions in pull requests

## Recognition

Contributors will be recognized in:

- The project's README
- Release notes for significant contributions
- GitHub's contributor graph

Thank you for contributing to mpesa2csv! 🎉
