# Deployment Instructions
- [1. Deploy on Localhost](#1-deploy-on-localhost)
- [2. Deploy using Docker](#2-deploy-using-docker)
- [3. Deploy to Azure](#3-deploy-to-azure)

## 1. Deploy on Localhost

### 1.1 Install Prerequisites

- [Get Latest Node.js](https://nodejs.org/en/download/)
- [Get Bot Framework Emulator](https://emulator.botframework.com/)

### 1.2 Setup

```bash
npm install
```

### 1.3 Start Service

```bash
npm start
```

:warning:
Alternatively running startdev automatically reloads when code changes.

```bash
npm run startdev
```

## 2. Deploy using docker

[![Docker Automated build](https://img.shields.io/docker/automated/jrottenberg/ffmpeg.svg)](https://hub.docker.com/r/elementolab/pmkb-hackfest/) [![Docker Pulls](https://img.shields.io/docker/pulls/elementolab/pmkb-hackfest.svg)](https://hub.docker.com/r/elementolab/pmkb-hacfest/) [![Docker Stars](https://img.shields.io/docker/stars/elementolab/pmkb-hackfest.svg)](https://hub.docker.com/r/elementolab/pmkb-hackfest/)

### 2.1 Supported tags and respective `Dockerfile` links

-       [`latest` (*latest/Dockerfile*)](https://github.com/ElementoLab/pmkb-hackfest/blob/master/Dockerfile)

### 2.2 Set Path of **ngrok** in bot emulator

[Instructions Link](https://github.com/microsoft/botframework-emulator/wiki/Tunneling-(ngrok))

:warning:
Make sure you have also set the ngrok path in bot framework emulator > Application Settings

### 2.3 Run docker container

```bash
docker run -d --name pmkb-bot \
-p ${PORT}:3978 \
--env-file ${PATH_TO_ENV_FILE}
-v ${PATH}:/usr/src/app \
-w /usr/src/app \
node:7.7.4 npm start
```

Where:
- **${PORT}**: External docker port.
- **${PATH_TO_ENV_FILE}**: Path to env file.
- **${PATH}**: Path to project files.

#### Example

```bash
docker run -d --name pmkb-bot \
-p 5000:3978 \
--env-file /Users/alex/Code/2.Github/pmkb-hackfest/docker.env \
-v /Users/alex/Code/2.Github/pmkb-hackfest:/usr/src/app \
-w /usr/src/app \
node:7.7.4 npm start
```

## 3. Deploy to Azure

[![Deploy to Azure](http://azuredeploy.net/deploybutton.png)](https://azuredeploy.net/)