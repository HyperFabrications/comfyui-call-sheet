#!/usr/bin/env bash
# Assemble the GitHub Pages site into _site/. Usage: scripts/build_site.sh [repo_url]
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site && mkdir -p _site
cp site/index.html web/core.js web/sheet.js web/gallery.js web/sheet.css web/poses.json _site/
sed -i "s|__REPO_URL__|${1:-https://github.com}|g" _site/index.html
touch _site/.nojekyll
echo "Built _site/"
