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

# Determine which Dockerfile to use
if [[ "$USE_LOCAL" == "local" ]] || [[ ! $(curl -s -o /dev/null -w "%{http_code}" https://github.com/lukemartinlogan/recipe-manager) == "200" ]]; then
    DOCKERFILE="Dockerfile.local"
    echo "🐳 Building Docker image (LOCAL): ${FULL_IMAGE_NAME}"
    echo "📁 Using local files instead of GitHub repository"
else
    DOCKERFILE="Dockerfile"
    echo "🐳 Building Docker image (GITHUB): ${FULL_IMAGE_NAME}"
    echo "📥 Will clone from GitHub repository"
fi

# Build the Docker image (from parent directory)
docker build -f "docker/${DOCKERFILE}" -t "${FULL_IMAGE_NAME}" ../

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
echo "   Local run:  docker run -p 3001:3001 ${FULL_IMAGE_NAME}"
echo "   With logs:  docker run -p 3001:3001 ${FULL_IMAGE_NAME} 2>&1"
echo "   Background: docker run -d -p 3001:3001 --name recipe-manager-app ${FULL_IMAGE_NAME}"
echo ""
echo "🔧 Build script usage:"
echo "   cd docker && ./build-and-deploy.sh                    # Build latest with GitHub repo"
echo "   cd docker && ./build-and-deploy.sh v1.0.0             # Build v1.0.0 with GitHub repo"
echo "   cd docker && ./build-and-deploy.sh latest local       # Build with local files"