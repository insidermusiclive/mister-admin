#!/bin/bash
# Double-click this file on a Mac to install Mister Admin into your Cloudflare account.
# If macOS refuses to open it, right-click → Open, then click Open again.
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download it from https://nodejs.org (LTS), install it, then double-click this file again."
  read -p "Press Enter to close… "
  exit 1
fi
node install/install.mjs
