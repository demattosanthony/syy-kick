## What is this

- chat with any of the top llms
- avoid subscription lock in
- pay by consumption
- own your data (don't really want openai to own my memory)

## Get started

1. Install Bun js runtime: https://bun.sh/docs/installation
2. Install and start Docker: https://docs.docker.com/get-docker/
3. Install Ghostscript:
   - Mac: `brew install ghostscript`
   - Ubuntu/Debian: `sudo apt-get install ghostscript`
   - Windows: Download installer from https://ghostscript.com/releases/gsdnld.html
4. Add environment variables as needed.

```bash
cd api
cp .env.example .env
# Update .env to have correct api keys
```

5. Install and run

```bash
./run.sh
```

Open the app at http://localhost:4001 and start chatting

## Demo

https://github.com/user-attachments/assets/b8c2bcd8-fc2e-4744-add3-c65405a76838

## Keyboard shortcuts

- CMD + L = toggle model selector
- CMD + K = focus on keyboard
- CMD + H = go to history
- CMD + B = toggle sidebare
- CMD + M = new chat

**People like to use the highest quality most pollished product**
