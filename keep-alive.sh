#!/bin/bash
# Wedding Album - Persistent Server Script
# This keeps the server running despite container cleanup

cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=256"
export PORT=3000

# Kill any existing server
pkill -f "node.*server.js" 2>/dev/null
sleep 1

echo "[$(date)] Starting Wedding Album server (persistent mode)..."

while true; do
  node server.js --dev &
  SERVER_PID=$!
  
  # Wait and check every 5 seconds
  while kill -0 $SERVER_PID 2>/dev/null; do
    sleep 5
  done
  
  echo "[$(date)] Server died (PID $SERVER_PID). Restarting in 2s..."
  sleep 2
done
