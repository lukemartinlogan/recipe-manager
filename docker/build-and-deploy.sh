#!/bin/bash

# Build and deploy script for recipe-manager Docker container
# Usage: ./build-and-deploy.sh [tag] [local]

set -e

# Configuration
DOCKERHUB_USERNAME="lukemartinlogan"
IMAGE_NAME="recipe-manager"
TAG="${1:-latest}"
USE_LOCAL="${2:-}"
FULL_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${TAG}"

# Build the Docker image - now it just builds the runtime container
echo "🐳 Building Docker runtime container: ${FULL_IMAGE_NAME}"
echo "📦 This container expects the application to be mounted at runtime"

# Ensure we're in the docker directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Build the Docker image (from docker directory)
docker build -f "Dockerfile" -t "${FULL_IMAGE_NAME}" .

echo "✅ Build completed successfully!"

# Ask for confirmation before pushing
read -p "🚀 Do you want to push to Docker Hub? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Pushing to Docker Hub..."
    
    # Login to Docker Hub (if not already logged in)
    echo "🔐 Please ensure you're logged in to Docker Hub"
    echo "If not logged in, run: docker login"
    
    # Push the image
    docker push "${FULL_IMAGE_NAME}"
    
    echo "✅ Successfully pushed ${FULL_IMAGE_NAME}"
    echo "🎉 You can now run the container with:"
    echo "   docker run -p 3001:3001 ${FULL_IMAGE_NAME}"
else
    echo "⏭️  Skipping Docker Hub push"
    echo "🏃 You can run the container locally with:"
    echo "   docker run -p 3001:3001 ${FULL_IMAGE_NAME}"
fi

echo ""
echo "📋 Available commands:"
echo "   Local run:  docker run -p 3050:3001 ${FULL_IMAGE_NAME}"
echo "   With logs:  docker run -p 3050:3001 ${FULL_IMAGE_NAME} 2>&1"
echo "   Background: docker run -d -p 3050:3001 --name recipe-manager-app ${FULL_IMAGE_NAME}"
echo ""
echo "🔧 Build script usage:"
echo "   ./docker/build-and-deploy.sh                          # Build latest runtime container"
echo "   ./docker/build-and-deploy.sh v1.0.0                   # Build v1.0.0 runtime container"
echo "   cd docker && ./build-and-deploy.sh                    # Also works from docker directory"
echo ""
echo "🏃 Usage examples:"
echo "   docker run -p 3050:3001 -v /path/to/recipe-manager:/app ${FULL_IMAGE_NAME}"
echo "   cd docker && cp .env.example .env && docker-compose up -d"
echo "   APP_SOURCE=/path/to/recipe-manager docker-compose up -d"