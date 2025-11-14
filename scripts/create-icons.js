const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create a simple blue square with white code symbol
const createIcon = async (size) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#4285f4"/>
      <text x="${size / 2}" y="${size * 0.7}" font-family="Arial" font-size="${size * 0.5}" fill="white" text-anchor="middle" font-weight="bold">&lt;/&gt;</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(iconDir, `icon${size}.png`));
};

(async () => {
  try {
    await createIcon(16);
    await createIcon(32);
    await createIcon(48);
    await createIcon(128);
    console.log('Icons created successfully!');
  } catch (error) {
    console.error('Error creating icons:', error);
    process.exit(1);
  }
})();
