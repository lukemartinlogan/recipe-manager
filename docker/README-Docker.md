# Docker Setup for Foods App

This repository includes Docker configuration for easy deployment of the Foods recipe application.

## Quick Start

### Option 1: Use Pre-built Image from Docker Hub
```bash
docker run -p 3001:3001 lukemartinlogan/recipe-manager:latest
```

### Option 2: Build Locally
```bash
# Build and optionally deploy to Docker Hub
./build-and-deploy.sh

# Or build manually
docker build -t lukemartinlogan/recipe-manager:latest .
docker run -p 3001:3001 lukemartinlogan/recipe-manager:latest
```

## What the Container Does

1. **Clones** the latest version from https://github.com/lukemartinlogan/recipe-manager.git
2. **Updates** the repository with `git pull` on every container start
3. **Installs** npm dependencies
4. **Starts** the application with `npm start`

## Usage

### Development
```bash
# Run with logs visible
docker run -p 3001:3001 lukemartinlogan/recipe-manager:latest

# Run in background
docker run -d -p 3001:3001 --name recipe-manager-app lukemartinlogan/recipe-manager:latest

# View logs of background container
docker logs -f recipe-manager-app
```

### Production
```bash
# Run with restart policy
docker run -d -p 3001:3001 --restart unless-stopped --name recipe-manager-app lukemartinlogan/recipe-manager:latest
```

## Build Script

The `build-and-deploy.sh` script provides an easy way to build and deploy:

```bash
# Build with default 'latest' tag
./build-and-deploy.sh

# Build with custom tag
./build-and-deploy.sh v1.0.0
```

## Environment Variables

The container runs on port 3001 by default. Map it to your desired port:

```bash
# Run on different port
docker run -p 8080:3001 lukemartinlogan/recipe-manager:latest
```

## Updating

Since the container pulls the latest code on startup, simply restart the container to get updates:

```bash
docker restart recipe-manager-app
```

## Docker Hub

The image is available at: `lukemartinlogan/recipe-manager:latest`