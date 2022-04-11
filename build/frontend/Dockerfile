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

ARG VITE_PUBLIC_WS_BASE
ARG VITE_PUBLIC_API_URL
ARG VITE_PUBLIC_WS_PATH
ARG VITE_PUBLIC_AUTH_URL
ARG VITE_ENABLE_SW

ENV VITE_PUBLIC_WS_BASE=${VITE_PUBLIC_WS_BASE}
ENV VITE_PUBLIC_WS_PATH=${VITE_PUBLIC_WS_PATH}
ENV VITE_PUBLIC_API_URL=${VITE_PUBLIC_API_URL}
ENV VITE_PUBLIC_AUTH_URL=${VITE_PUBLIC_AUTH_URL}
ENV VITE_ENABLE_SW=${VITE_ENABLE_SW}

RUN yarn web-app build

FROM nginx:alpine

WORKDIR /home/app

COPY --from=base /home/app/packages/web-app/dist /var/www/html
COPY build/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx","-g","daemon off;"]
