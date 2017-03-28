# Installation Instructions
- [Get Visual Studio Code](https://code.visualstudio.com/Download)
- [Get Node.js 7.7.4](https://nodejs.org/en/download/)
- [Get Bot Framework Emulator](https://emulator.botframework.com/)

## Setup

```bash
npm install --save -g
npm install node-dev -g
npm install
```

## Run Node.js

```bash
node app.js
npm run startdev
```

## Deployment using docker (In Progress)

```bash
docker run -d --name pmkb-bot \
-p ${PORT}:3978 \
-v ${PATH}:/usr/src/app \
-w /usr/src/app \
node:7.7.4
```