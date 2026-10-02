#!/bin/bash
# Start Mission Control v2 - Next.js only (no separate server needed)

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start Next.js dev server
echo "Starting Mission Control v2..."
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:3000/api/"

npx next dev -p 3000
