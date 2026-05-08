#!/bin/bash
set -e

echo "Starting OpenClaw GrindGuard Installation..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js >= 22."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "Node.js version is $NODE_VERSION. OpenClaw requires Node.js >= 22."
    exit 1
fi

# Install dependencies
echo "Installing Root Dependencies..."
npm install

echo "Installing Backend Dependencies..."
cd backend
npm install
cd ..

# Check if .env exists, if not, copy .env.example
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env from backend/.env.example"
    cp backend/.env.example backend/.env
    echo "Please update backend/.env with your API keys!"
fi

echo "Installation complete!"
echo "Run 'docker-compose up' to start the system, or 'npm run dev' locally."
