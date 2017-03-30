FROM node:7.7.4
MAINTAINER Alexandros Sigaras

WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

EXPOSE 3978

CMD [ “npm”, “start” ]