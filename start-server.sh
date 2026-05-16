#!/bin/bash
# Wedding Album Server - Keep Alive Script
cd /home/z/my-project

export NODE_OPTIONS="--max-old-space-size=512"

echo "[$(date)] Starting Wedding Album server..."

while true; do
  echo "[$(date)] Starting Next.js dev server..."
  npx next dev -p 3000 2>&1 &
  SERVER_PID=$!
  
  # Wait for it to start
  sleep 8
  
  # Check if still running
  if kill -0 $SERVER_PID 2>/dev/null; then
    echo "[$(date)] Server started with PID $SERVER_PID"
    # Wait for it to die
    wait $SERVER_PID
    echo "[$(date)] Server died with exit code $?"
  else
    echo "[$(date)] Server failed to start"
  fi
  
  echo "[$(date)] Restarting in 3 seconds..."
  sleep 3
done
