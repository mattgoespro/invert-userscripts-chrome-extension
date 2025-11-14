/**
 * Example 2: GitHub Dark Mode Toggle
 * 
 * Adds a dark mode toggle button to GitHub pages.
 * 
 * URL Pattern: https://github.com/*
 * Run At: document_idle
 */

interface DarkModeState {
  enabled: boolean;
}

class GitHubDarkMode {
  private state: DarkModeState = { enabled: false };
  private button: HTMLButtonElement | null = null;

  constructor() {
    this.loadState();
    this.init();
  }

  private loadState(): void {
    const saved = localStorage.getItem('vertex-ide-dark-mode');
    if (saved) {
      this.state = JSON.parse(saved);
    }
  }

  private saveState(): void {
    localStorage.setItem('vertex-ide-dark-mode', JSON.stringify(this.state));
  }

  private init(): void {
    this.createButton();
    if (this.state.enabled) {
      this.enableDarkMode();
    }
  }

  private createButton(): void {
    this.button = document.createElement('button');
    this.button.textContent = this.state.enabled ? '🌙' : '☀️';
    this.button.title = 'Toggle Dark Mode';
    this.button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      width: 50px;
      height: 50px;
      background: white;
      border: 2px solid #e1e4e8;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s;
    `;

    this.button.onclick = () => this.toggle();
    document.body.appendChild(this.button);
  }

  private toggle(): void {
    this.state.enabled = !this.state.enabled;
    this.saveState();

    if (this.state.enabled) {
      this.enableDarkMode();
    } else {
      this.disableDarkMode();
    }

    if (this.button) {
      this.button.textContent = this.state.enabled ? '🌙' : '☀️';
    }
  }

  private enableDarkMode(): void {
    const style = document.createElement('style');
    style.id = 'vertex-ide-dark-mode';
    style.textContent = `
      body {
        filter: invert(1) hue-rotate(180deg);
      }
      img, video, [style*="background-image"] {
        filter: invert(1) hue-rotate(180deg);
      }
    `;
    document.head.appendChild(style);
  }

  private disableDarkMode(): void {
    const style = document.getElementById('vertex-ide-dark-mode');
    if (style) {
      style.remove();
    }
  }
}

// Initialize the dark mode toggle
new GitHubDarkMode();
