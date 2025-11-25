/**
 * Example 3: YouTube Speed Controller
 *
 * Adds custom playback speed controls to YouTube videos.
 *
 * URL Pattern: https://www.youtube.com/*
 * Run At: document_idle
 */

class YouTubeSpeedController {
  private speeds: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  private currentSpeed: number = 1;
  private container: HTMLDivElement = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Wait for video element to be available
    const checkVideo = setInterval(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        clearInterval(checkVideo);
        this.createUI();
        this.loadSavedSpeed(video);
      }
    }, 1000);
  }

  private loadSavedSpeed(video: HTMLVideoElement): void {
    const saved = localStorage.getItem('vertex-ide-yt-speed');
    if (saved) {
      this.currentSpeed = parseFloat(saved);
      video.playbackRate = this.currentSpeed;
      this.updateDisplay();
    }
  }

  private createUI(): void {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 99999;
      background: rgba(0, 0, 0, 0.8);
      padding: 12px;
      border-radius: 8px;
      color: white;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;

    const title = document.createElement('div');
    title.textContent = '⚡ Speed Control';
    title.style.cssText = 'margin-bottom: 8px; font-weight: bold;';
    this.container.appendChild(title);

    const speedDisplay = document.createElement('div');
    speedDisplay.id = 'vertex-speed-display';
    speedDisplay.style.cssText = 'margin-bottom: 8px; text-align: center;';
    this.container.appendChild(speedDisplay);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';

    this.speeds.forEach((speed) => {
      const button = document.createElement('button');
      button.textContent = `${speed}x`;
      button.style.cssText = `
        padding: 6px 10px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      `;
      button.onmouseover = () => {
        button.style.background = '#5568d3';
      };
      button.onmouseout = () => {
        button.style.background = '#667eea';
      };
      button.onclick = () => this.setSpeed(speed);
      buttonContainer.appendChild(button);
    });

    this.container.appendChild(buttonContainer);
    document.body.appendChild(this.container);
    this.updateDisplay();
  }

  private setSpeed(speed: number): void {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video) {
      this.currentSpeed = speed;
      video.playbackRate = speed;
      localStorage.setItem('vertex-ide-yt-speed', speed.toString());
      this.updateDisplay();
    }
  }

  private updateDisplay(): void {
    const display = document.getElementById('vertex-speed-display');
    if (display) {
      display.textContent = `Current: ${this.currentSpeed}x`;
    }
  }
}

// Initialize the speed controller
new YouTubeSpeedController();
