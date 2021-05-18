#!/bin/bash

export SNOWPACK_PUBLIC_RELEASE_VERSION=`git rev-parse --short HEAD`

if [[ -z "${SENTRY_AUTH_TOKEN}" ]]; then
  echo "SENTRY_AUTH_TOKEN not set"

  exit 1
fi

echo "Building release:" $NX_RELEASE_VERSION

NODE_ENV=production yarn web-app build

rm -Rf packages/web-app/build/**/*.map

