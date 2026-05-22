#!/bin/bash
# Load env variables, ignoring comments and blank lines
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "=== PUSHING DATABASE SCHEMA ==="
yes | ./node_modules/.bin/drizzle-kit push

echo ""
echo "=== RUNNING DATABASE CONNECTION TEST ==="
./node_modules/.bin/tsx src/db/test-db-connection.ts

echo ""
echo "=== RUNNING tRPC API ROUTER TEST ==="
./node_modules/.bin/tsx src/db/test-api.ts
