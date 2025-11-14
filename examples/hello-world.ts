/**
 * Example 1: Hello World
 * 
 * A simple userscript that logs a message and adds a button to the page.
 * 
 * URL Pattern: https://example.com/*
 * Run At: document_idle
 */

console.log('Hello from Vertex IDE Userscript!');

// Add a custom button to the page
const button = document.createElement('button');
button.textContent = 'Vertex IDE Button';
button.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s, box-shadow 0.2s;
`;

button.onmouseover = () => {
  button.style.transform = 'translateY(-2px)';
  button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
};

button.onmouseout = () => {
  button.style.transform = 'translateY(0)';
  button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
};

button.onclick = () => {
  alert('🎉 Hello from Vertex IDE!');
};

document.body.appendChild(button);
