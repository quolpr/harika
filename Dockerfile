FROM node:16 as base

WORKDIR /home/app

COPY package.json ./
COPY yarn.lock ./
RUN  mkdir -p packages/harika-api
RUN  mkdir -p packages/sync-common
COPY packages/harika-api/package.json ./packages/harika-api
COPY packages/sync-common/package.json ./packages/sync-common

RUN yarn

COPY packages/harika-api ./packages/harika-api
COPY packages/sync-common ./packages/sync-common

RUN sed -i 's/index\.ts/dist\/index\.js/' ./packages/sync-common/package.json

FROM base as production

ENV NODE_ENV=production
WORKDIR /home/app/packages/sync-common
RUN yarn build
WORKDIR /home/app/packages/harika-api
RUN yarn build
ENTRYPOINT ./start.sh
