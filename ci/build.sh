#!/usr/bin/env bash
# -*- coding: utf-8 -*-

SCRIPT=$(realpath "$0")
SCRIPTPATH=$(dirname "$SCRIPT")
cd "$SCRIPTPATH"
cd ..

pnpm install --frozen-lockfile
cd ./themes/kratos-rebirth
pnpm install --frozen-lockfile
pnpm run build
cd ../..
pnpm exec hexo g
