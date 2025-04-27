## What is this

- Automated AI workflows for the AECO (Architecture, Engineering, Construction, Operations) Industry

## Get started

1. Install Bun js runtime: https://bun.sh/docs/installation
2. Install and start Docker: https://docs.docker.com/get-docker/
3. Install Ghostscript and ImageMagick:
   - Mac: `brew install ghostscript imagemagick`
   - Ubuntu/Debian: `sudo apt-get install ghostscript imagemagick`
   - Windows:
     - Ghostscript: Download installer from https://ghostscript.com/releases/gsdnld.html
     - ImageMagick: Download installer from https://imagemagick.org/script/download.php
4. Install markitdown cli: `pip install 'markitdown[all]'`
5. Add environment variables as needed.

```bash
cd api
cp .env.example .env
# Update .env to have correct api keys
```

5. Install and run

```bash
./run.sh
```

Open the app at http://localhost:4001

## Keyboard shortcuts

- CMD + L = toggle model selector
- CMD + K = focus on keyboard
- CMD + H = go to history
- CMD + B = toggle sidebare
- CMD + M = new chat

**People like to use the highest quality most pollished product**
