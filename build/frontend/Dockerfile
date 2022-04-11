FROM node:latest as base


WORKDIR /home/app

COPY package.json ./
COPY yarn.lock ./
COPY patches ./patches
RUN  mkdir -p packages/sync-common
RUN  mkdir -p packages/web-app
RUN  mkdir -p packages/web-core
COPY packages/sync-common/package.json ./packages/sync-common
COPY packages/web-app/package.json ./packages/web-app
COPY packages/web-core/package.json ./packages/web-core

RUN yarn

COPY packages/sync-common ./packages/sync-common
COPY packages/web-app ./packages/web-app
COPY packages/web-core ./packages/web-core

ENV VITE_PUBLIC_WS_BASE "http://localhost:3000"
ENV VITE_PUBLIC_API_URL "http://localhost:3000/api"
ENV VITE_PUBLIC_WS_PATH "/api/socket.io"

ENV VITE_PUBLIC_AUTH_URL "http://localhost:3000/api/auth"

RUN yarn web-app build

FROM nginx:alpine

WORKDIR /home/app

COPY --from=base /home/app/packages/web-app/dist /var/www/html
COPY build/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx","-g","daemon off;"]
