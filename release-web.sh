#!/bin/bash

set -e

export SNOWPACK_PUBLIC_PACKAGE_VERSION="$(date +'%d.%m.%Y-%R:%S')@$(git rev-parse --short HEAD)"
export SENTRY_ORG="harika"
export SENTRY_PROJECT="web-dev"

if [[ -z "${SENTRY_AUTH_TOKEN}" ]]; then
  echo "SENTRY_AUTH_TOKEN not set"

  exit 1
fi

yarn sentry-cli releases new "$SNOWPACK_PUBLIC_PACKAGE_VERSION"

yarn sentry-cli releases set-commits "$SNOWPACK_PUBLIC_PACKAGE_VERSION" --auto

echo "Building release:" $SNOWPACK_PUBLIC_PACKAGE_VERSION

NODE_ENV=production yarn web-app build

yarn sentry-cli releases files "$SNOWPACK_PUBLIC_PACKAGE_VERSION" upload-sourcemaps packages/web-app/build/js \
    --url-prefix '~/js'

yarn sentry-cli releases finalize "$SNOWPACK_PUBLIC_PACKAGE_VERSION"

rm -Rf packages/web-app/build/dist
rm -Rf packages/web-app/build/css
rm -Rf packages/web-app/build/_snowpack
rm -Rf packages/web-app/build/@harika
rm -Rf packages/web-app/build/**/*.map

