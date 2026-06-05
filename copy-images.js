const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/yaswa/.gemini/antigravity/brain/3532cc12-216a-4a06-95dc-6923e0e3684c';
const destDir = 'C:/Users/yaswa/.gemini/antigravity/scratch/nft-marketplace/assets';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(
  path.join(srcDir, 'media__1780668932491.png'),
  path.join(destDir, 'home-v2.png')
);

fs.copyFileSync(
  path.join(srcDir, 'media__1780668932467.png'),
  path.join(destDir, 'explore-v2.png')
);

console.log('Images copied successfully.');
