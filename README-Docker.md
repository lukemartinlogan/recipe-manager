# Docker Setup

All Docker-related files have been moved to the `docker/` subdirectory for better organization.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Quick start with defaults (port 3050, mounts parent directory)
cd docker && docker-compose up -d

# Customize with environment variables
cd docker && APP_SOURCE=/path/to/recipe-manager HOST_PORT=8080 docker-compose up -d

# Use environment file
cd docker && cp .env.example .env
# Edit .env file with your settings
cd docker && docker-compose up -d
```

### Using Direct Docker Run

```bash
# Mount your recipe-manager repository (default port 3050)
docker run -p 3050:3001 -v /path/to/recipe-manager:/app lukemartinlogan/recipe-manager:latest
```

### Using Build Script

```bash
# Build and deploy runtime container
cd docker && ./build-and-deploy.sh
```

## Documentation

- **[External App Setup](./docker/README-External-App.md)** - Complete external application guide
- **[Docker Compose Setup](./docker/README-Docker-Compose.md)** - Docker Compose configurations
- **[Docker Setup](./docker/README-Docker.md)** - Basic Docker usage

## Directory Structure

```
docker/
├── Dockerfile                    # Runtime container only
├── docker-compose.yml           # Single configurable setup
├── nginx.conf                   # Nginx configuration
├── build-and-deploy.sh          # Build runtime container
├── .env                         # Default environment config
├── .env.example                 # Environment template
└── README-*.md                  # Documentation files
```

## Key Features

- **External Application**: Mount any recipe-manager repository
- **Runtime Only**: Container provides Node.js environment only
- **No Rebuilds**: Update code without rebuilding container
- **Live Development**: Edit code on host, see changes immediately
- **Data Persistence**: SQLite database preserved across updates
- **Multiple Environments**: One container, multiple app versions
- **Easy Deployment**: Automated build and deployment scripts