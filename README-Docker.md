# Docker Setup

All Docker-related files have been moved to the `docker/` subdirectory for better organization.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Development (GitHub repo)
cd docker && docker-compose up -d

# Local development
cd docker && docker-compose -f docker-compose.local.yml up -d

# Production
cd docker && docker-compose -f docker-compose.prod.yml up -d
```

### Using Build Script

```bash
# Build and deploy
cd docker && ./build-and-deploy.sh

# Build with local files
cd docker && ./build-and-deploy.sh latest local
```

## Documentation

- **[Docker Setup](./docker/README-Docker.md)** - Basic Docker usage
- **[Docker Compose Setup](./docker/README-Docker-Compose.md)** - Comprehensive Docker Compose guide

## Directory Structure

```
docker/
├── Dockerfile                    # GitHub-based build
├── Dockerfile.local             # Local file-based build
├── docker-compose.yml           # Standard development
├── docker-compose.local.yml     # Local development
├── docker-compose.prod.yml      # Production with SSL
├── nginx.conf                   # Nginx configuration
├── build-and-deploy.sh          # Automated build script
├── README-Docker.md             # Docker documentation
└── README-Docker-Compose.md     # Docker Compose documentation
```

## Key Features

- **Multiple Build Options**: GitHub repo or local files
- **Environment-Specific Configs**: Development, local, and production
- **Data Persistence**: SQLite database and images preserved
- **SSL Support**: Optional nginx reverse proxy
- **Health Monitoring**: Built-in health checks
- **Easy Deployment**: Automated build and deployment scripts