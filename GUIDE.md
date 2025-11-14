# Vertex IDE Userscripts - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Creating Your First Script](#creating-your-first-script)
3. [Understanding URL Patterns](#understanding-url-patterns)
4. [TypeScript Features](#typescript-features)
5. [Global Modules](#global-modules)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Installation
1. Download and install the extension (see main README.md)
2. Click the extension icon in your Chrome toolbar
3. You'll see the popup showing "No scripts yet"
4. Click "Create Script" or "⚙️ Options" to open the IDE

### Interface Overview

The Vertex IDE has three main tabs:

- **📝 Scripts**: Create and edit userscripts with the Monaco editor
- **📦 Global Modules**: Manage CDN libraries shared across all scripts
- **⚙️ Settings**: Customize your IDE experience

## Creating Your First Script

### Step 1: Create a New Script
1. Open the Options page (right-click extension icon → Options)
2. In the Scripts tab, click the ➕ button
3. A new script "New Script" will be created with default content

### Step 2: Configure the Script
1. **Name**: Click on "New Script" to edit the name (e.g., "My First Script")
2. **Description**: Add a description of what your script does
3. **Enabled**: Check this box to activate the script

### Step 3: Write Your Code
The editor comes pre-loaded with a simple example:
```typescript
// Start coding your userscript here
console.log("Hello from Vertex IDE!");
```

You can write any JavaScript or TypeScript code. For example:
```typescript
// Add a custom element to the page
const banner = document.createElement('div');
banner.textContent = 'Enhanced by Vertex IDE!';
banner.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #667eea;
  color: white;
  padding: 10px;
  text-align: center;
  z-index: 99999;
`;
document.body.appendChild(banner);
```

### Step 4: Add URL Patterns
Click "+ Add Pattern" and enter URL patterns where your script should run:
- `https://example.com/*` - All pages on example.com
- `https://github.com/*/*` - All GitHub repository pages
- `*://*.google.com/*` - All Google domains (http and https)

### Step 5: Compile and Enable
1. Click "🔧 Compile & Bundle" to transpile your TypeScript to JavaScript
2. Check the "Enabled" checkbox
3. Navigate to a page matching your URL pattern
4. Your script will automatically run!

## Understanding URL Patterns

URL patterns use glob-style matching:

### Exact Match
```
https://www.example.com/page.html
```
Matches only this specific URL.

### Wildcard Subdirectories
```
https://example.com/*
```
Matches all pages on example.com (e.g., `/about`, `/contact`, `/products/item`)

### Wildcard Subdomains
```
https://*.example.com/*
```
Matches all subdomains (e.g., `www.example.com`, `blog.example.com`)

### Protocol Wildcard
```
*://example.com/*
```
Matches both HTTP and HTTPS

### Multiple Patterns
You can add multiple patterns to one script:
- `https://github.com/*`
- `https://gitlab.com/*`

The script will run on any page matching ANY of the patterns.

## TypeScript Features

### IntelliSense
As you type, the editor provides:
- Auto-completion for JavaScript/TypeScript APIs
- DOM API suggestions
- Parameter hints
- Quick documentation

### Type Checking
Enable "Enable type checking" in Settings to see errors in real-time:
```typescript
// This will show an error:
const num: number = "string"; // Type 'string' is not assignable to type 'number'
```

### Modern TypeScript
You can use modern TypeScript features:
```typescript
// Interfaces
interface User {
  name: string;
  age: number;
}

// Arrow functions
const greet = (user: User): string => {
  return `Hello, ${user.name}!`;
};

// Async/await
async function fetchData(): Promise<void> {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  console.log(data);
}

// Optional chaining
const userName = user?.profile?.name ?? 'Anonymous';
```

### Compilation
Click "🔧 Compile & Bundle" to:
1. Check for TypeScript errors
2. Transpile to JavaScript (ES2020)
3. Show the compiled output
4. Save the result for injection

## Global Modules

Global modules are libraries loaded before your userscripts, making them available everywhere.

### Adding a Module
1. Go to the "📦 Global Modules" tab
2. Click "+ Add Module"
3. Enter module details:
   - **Name**: jQuery
   - **URL**: `https://code.jquery.com/jquery-3.6.0.min.js`
4. Enable the module

### Using Modules in Scripts
Once added, you can use the library in your scripts:
```typescript
// Using jQuery (if added as global module)
declare const $: any;

$('body').css('background-color', '#f0f0f0');
$('<div>').text('Added with jQuery').appendTo('body');
```

### Popular CDN Libraries
- **jQuery**: `https://code.jquery.com/jquery-3.6.0.min.js`
- **Lodash**: `https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js`
- **Axios**: `https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js`
- **Moment.js**: `https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js`

## Best Practices

### 1. Use Meaningful Names
```typescript
// Good
const createWelcomeMessage = () => { /* ... */ };

// Bad
const fn1 = () => { /* ... */ };
```

### 2. Check for Elements
```typescript
// Wait for elements to exist
const waitForElement = (selector: string): Promise<Element> => {
  return new Promise((resolve) => {
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
};

// Usage
waitForElement('.my-element').then((element) => {
  console.log('Element found!', element);
});
```

### 3. Avoid Conflicts
```typescript
// Wrap your code in an IIFE to avoid polluting global scope
(function() {
  const myVariable = 'private';
  console.log(myVariable);
})();
```

### 4. Handle Errors
```typescript
try {
  // Your code here
  const element = document.querySelector('.my-element');
  if (element) {
    element.textContent = 'Updated!';
  }
} catch (error) {
  console.error('Userscript error:', error);
}
```

### 5. Use CSS-in-JS
```typescript
const addStyles = (css: string): void => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
};

addStyles(`
  .my-custom-class {
    color: blue;
    font-weight: bold;
  }
`);
```

## Troubleshooting

### Script Not Running
1. **Check if enabled**: Ensure the script is enabled in the popup
2. **Verify URL pattern**: Make sure the pattern matches the current page
3. **Check console**: Open DevTools (F12) and look for errors
4. **Recompile**: Click "🔧 Compile & Bundle" again

### TypeScript Errors
1. **Type checking disabled**: Enable it in Settings
2. **Missing types**: Add type declarations with `declare`
3. **Syntax errors**: Check the error messages in the editor

### Script Timing Issues
If elements aren't available:
```typescript
// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Your code here
}
```

### Performance Issues
1. **Large scripts**: Split into multiple smaller scripts
2. **Heavy operations**: Use `requestIdleCallback` or `setTimeout`
3. **Too many patterns**: Be specific with URL patterns

### Storage Issues
If scripts aren't saving:
1. Check Chrome storage quota (unlikely to hit limit)
2. Look for errors in DevTools console
3. Try exporting and re-importing scripts

## Advanced Tips

### Accessing Chrome APIs
Some Chrome APIs are available in userscripts:
```typescript
// Storage API (if you need to store data)
chrome.storage.local.set({ key: 'value' });
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});
```

### Dynamic Script Loading
```typescript
const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
};

// Usage
loadScript('https://cdn.example.com/lib.js').then(() => {
  console.log('Library loaded!');
});
```

### Mutation Observers
Watch for DOM changes:
```typescript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element && node.matches('.target-class')) {
        console.log('Target element added!', node);
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

## Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Review this guide
3. Check the examples in the `examples/` folder
4. Open an issue on GitHub

Happy scripting! 🚀
