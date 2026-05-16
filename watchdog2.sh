#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=256"
export HOSTNAME="0.0.0.0"

while true; do
  echo "[$(date)] Starting production server..."
  node .next/standalone/server.js &
  PID=$!
  
  # Wait for startup
  sleep 3
  
  # Wait for death
  while kill -0 $PID 2>/dev/null; do
    sleep 2
  done
  
  echo "[$(date)] Server died. Restarting..."
  sleep 2
done
