rm -rf dist
esbuild src/main.ts --bundle --external:html-rewriter --external:http-request --external:create-response --platform=neutral --outdir=dist
cp bundle.json dist/bundle.json
tar -czvf ak-bundle.tgz dist/main.js dist/bundle.json
