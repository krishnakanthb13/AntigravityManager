#!/bin/bash

# Antigravity Manager Launcher for Unix-like systems (macOS, Linux)

APP_NAME="Antigravity Manager"
echo "=========================================="
echo "      $APP_NAME Launcher"
echo "=========================================="
echo ""

# Function to handle exit
cleanup() {
    echo ""
    echo "[INFO] Shutting down launcher..."
    # Kill any child processes (the electron app)
    kill 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

# 2. Check for npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not installed."
    exit 1
fi

# 3. Check for node_modules
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules not found. Running npm install..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] npm install failed."
        exit 1
    fi
fi

# 4. Start the application
echo "[INFO] Starting $APP_NAME..."
npm start

# Keep the script alive to allow the trap to work, though npm start is usually blocking
wait
