#!/bin/bash

set -e

export VITE_PUBLIC_PACKAGE_VERSION="$(date +'%d.%m.%Y-%R:%S')@$(git rev-parse --short HEAD)"
export SENTRY_ORG="harika"
export SENTRY_PROJECT="web-dev"

if [[ -z "${SENTRY_AUTH_TOKEN}" ]]; then
  echo "SENTRY_AUTH_TOKEN not set"

  exit 1
fi

yarn sentry-cli releases new "$VITE_PUBLIC_PACKAGE_VERSION"

yarn sentry-cli releases set-commits "$VITE_PUBLIC_PACKAGE_VERSION" --auto

echo "Building release:" $VITE_PUBLIC_PACKAGE_VERSION

NODE_ENV=production yarn web-app build

yarn sentry-cli releases finalize "$VITE_PUBLIC_PACKAGE_VERSION"

