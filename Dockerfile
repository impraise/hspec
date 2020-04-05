FROM node:alpine

ADD . /app
WORKDIR /app

RUN npm install --quiet && \
    NODE_ENV=production npm run build && \
    npm prune --production

CMD node dist/index.js
