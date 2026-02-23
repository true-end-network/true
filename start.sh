#!/bin/sh
# Start both relay and web server in one process
echo "Starting True relay on port ${RELAY_PORT:-3001}..."
node relay/dist/relay/server.js &
RELAY_PID=$!

echo "Starting True web on port ${PORT:-3000}..."
node server.js &
WEB_PID=$!

# Wait for either to exit
wait -n $RELAY_PID $WEB_PID
EXIT_CODE=$?
kill $RELAY_PID $WEB_PID 2>/dev/null
exit $EXIT_CODE
