#!/bin/bash

# Start API Server Script
# This script starts the AdminAPI backend server

echo "Starting AdminAPI Backend Server..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found!"
    echo "Please create a .env file with the following variables:"
    echo "  SUPABASE_URL=your-supabase-url"
    echo "  SUPABASE_KEY=your-supabase-key"
    echo "  API_PORT=3000"
    echo "  CORS_ORIGIN=http://localhost:5173"
    echo "  ADMIN_USER_ID=admin"
    echo ""
    echo "You can copy .env.example to .env and update the values."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Start the API server
echo "Starting API server..."
echo "Press Ctrl+C to stop"
echo ""

npm run api
