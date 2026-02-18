#!/bin/bash

# Build React frontend
echo "Building React frontend..."
cd frontend
npm install
npm run build

echo "Build complete!"
echo "Built files are in: static/react/"
