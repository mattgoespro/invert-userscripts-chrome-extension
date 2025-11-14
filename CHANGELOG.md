# Changelog

All notable changes to the Vertex IDE Userscripts Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-14

### Added
- Initial release of Vertex IDE Userscripts Extension
- Full-featured Monaco Editor integration for TypeScript and SCSS editing
- IntelliSense support with auto-completion and type hints
- Multiple editor themes (Dark, Light, High Contrast)
- Auto-formatting on save
- Real-time type checking
- One-click TypeScript compilation and bundling
- URL pattern-based script injection system
- Global module management via CDN
- Chrome Storage API integration for persistent data
- Background service worker for automatic script injection
- Popup UI for quick script management
- Options page with comprehensive IDE interface
- Script enable/disable toggle
- Script metadata editing (name, description)
- Multiple URL patterns per script
- Example userscripts demonstrating key features
- Comprehensive user guide and documentation

### Features

#### IDE Features
- Monaco Editor with full TypeScript support
- IntelliSense and auto-completion
- Syntax highlighting for TypeScript, JavaScript, SCSS, and CSS
- Real-time type checking with error reporting
- Auto-formatting using Prettier integration
- Customizable editor settings (theme, font size, tab size)
- Auto-save functionality

#### Script Management
- Create unlimited userscripts
- Edit scripts with full IDE capabilities
- Enable/disable scripts individually
- Delete scripts with confirmation
- URL pattern matching for automatic injection
- Support for multiple URL patterns per script
- Script compilation and bundling

#### Global Modules
- Add CDN libraries accessible across all scripts
- Enable/disable modules individually
- Version management support
- Easy module deletion

#### Extension Infrastructure
- Chrome Extension Manifest V3 support
- TypeScript build system with Webpack
- React-based UI components
- SCSS styling support
- Chrome Storage API for data persistence
- Background service worker for script injection
- Content script support

### Technical Stack
- TypeScript 5.9+
- React 19.2+
- Monaco Editor 0.54+
- Webpack 5.102+
- SCSS/Sass
- Chrome Extension Manifest V3

### Build System
- Webpack bundling with code splitting
- TypeScript compilation
- SCSS preprocessing
- Asset copying and optimization
- Source map generation for development
- Production minification

### Documentation
- Comprehensive README with installation and usage instructions
- Detailed user guide (GUIDE.md)
- Example userscripts demonstrating common patterns
- Inline code documentation
- Architecture overview

[1.0.0]: https://github.com/mattgoespro/chrome-vertex-ide-userscripts-extension/releases/tag/v1.0.0
