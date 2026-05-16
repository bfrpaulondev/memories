#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=256"

while true; do
  echo "[$(date)] Starting Next.js..."
  npx next dev -p 3000 2>&1 &
  PID=$!
  
  # Wait for it to start
  for i in $(seq 1 30); do
    sleep 1
    if ! kill -0 $PID 2>/dev/null; then
      echo "[$(date)] Process died during startup"
      break
    fi
    # Check if server is ready
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
      echo "[$(date)] Server ready (PID $PID)"
      break
    fi
  done
  
  # Now wait for it to die
  while kill -0 $PID 2>/dev/null; do
    sleep 2
  done
  
  echo "[$(date)] Server died. Restarting..."
  sleep 2
done
