# Contributing to Vertex IDE Userscripts Extension

Thank you for your interest in contributing to Vertex IDE! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Chrome browser for testing
- Git for version control

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/chrome-vertex-ide-userscripts-extension.git
   cd chrome-vertex-ide-userscripts-extension
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the extension:
   ```bash
   npm run build
   ```

5. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Development Workflow

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run the linter:
   ```bash
   npm run lint
   ```

4. Build the extension:
   ```bash
   npm run build
   ```

5. Test your changes in Chrome

6. Commit your changes:
   ```bash
   git add .
   git commit -m "Add your descriptive commit message"
   ```

7. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

8. Open a Pull Request on GitHub

## Project Structure

```
src/
├── background/      # Background service worker
├── popup/          # Extension popup UI
├── options/        # Options page with IDE
├── content/        # Content scripts
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use meaningful variable and function names

### React

- Use functional components with hooks
- Keep components focused and single-purpose
- Use proper prop types
- Follow React best practices

### CSS/SCSS

- Use SCSS for styling
- Follow BEM naming convention when appropriate
- Keep styles modular and reusable
- Avoid inline styles unless necessary

### Code Style

- Follow the existing code style
- Use Prettier for formatting: `npm run format`
- Use ESLint for linting: `npm run lint`
- Write clear, self-documenting code
- Add comments for complex logic

## Commit Messages

Follow the conventional commits specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```
feat: add SCSS file support to editor
fix: correct URL pattern matching for subdomains
docs: update installation instructions in README
```

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update documentation if needed
3. Test your changes thoroughly
4. Ensure the build succeeds without errors
5. Provide a clear description of your changes
6. Link any related issues

## Testing

Currently, the project doesn't have automated tests. When making changes:

1. Manually test in Chrome
2. Test different scenarios
3. Check the browser console for errors
4. Verify existing functionality still works

## Reporting Bugs

When reporting bugs, please include:

- Chrome version
- Extension version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Browser console errors if any

## Suggesting Features

We welcome feature suggestions! Please:

- Check if the feature already exists
- Check if it's already been suggested
- Provide a clear use case
- Describe the expected behavior
- Consider implementation details

## Documentation

When adding features, please update:

- README.md - If it affects installation or basic usage
- GUIDE.md - If it affects user-facing functionality
- Code comments - For complex implementations
- CHANGELOG.md - For all changes

## Questions?

If you have questions:

1. Check the existing documentation
2. Search for existing issues
3. Open a new issue with your question

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).

Thank you for contributing! 🚀
