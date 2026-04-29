#!/bin/bash
# 1. Trỏ trực tiếp đến Node 22 (Bỏ qua hoàn toàn nvm và npm để không bị treo)
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"

echo "Đang khởi chạy với Node.js: $(node -v)"

# 2. Generate API types từ OpenAPI spec
pnpm gen:api

# 3. Chạy file Vite JS trực tiếp bằng Node 22 (bỏ qua pnpm)
node ./node_modules/vite/bin/vite.js
