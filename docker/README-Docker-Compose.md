# Docker Compose Setup for Recipe Manager

This repository includes multiple Docker Compose configurations for different deployment scenarios.

## Available Configurations

### 1. Standard Development (`docker-compose.yml`)
- Builds from GitHub repository
- Port 3001 exposed
- Persistent data volumes
- Health checks enabled

### 2. Local Development (`docker-compose.local.yml`)
- Builds from local files
- Source code mounted for development
- Port 3001 exposed
- Separate local data volume

### 3. Production (`docker-compose.prod.yml`)
- Uses pre-built Docker Hub image
- Port 80 exposed
- Resource limits
- Optional nginx reverse proxy with SSL

## Quick Start

### Development (GitHub repo)
```bash
cd docker
docker-compose up -d
```

### Local Development
```bash
cd docker
docker-compose -f docker-compose.local.yml up -d
```

### Production
```bash
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

### Production with NGINX (SSL)
```bash
cd docker
# First, add your SSL certificates to ./ssl/cert.pem and ./ssl/key.pem
docker-compose -f docker-compose.prod.yml --profile with-nginx up -d
```

## Data Persistence

All configurations include persistent volumes for:
- **Database**: SQLite database files
- **Images**: Recipe images and uploads
- **Source code**: (local development only)

### Volume Management
```bash
# List volumes
docker volume ls | grep recipe

# Backup database
docker run --rm -v recipe_data:/data -v $(pwd):/backup alpine cp -r /data /backup/db_backup

# Restore database  
docker run --rm -v recipe_data:/data -v $(pwd):/backup alpine cp -r /backup/db_backup/* /data/
```

## Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Scale if needed (multiple instances)
docker-compose up -d --scale recipe-manager=2

# Check service health
docker-compose ps
```

## Environment Variables

You can create a `.env` file to customize settings:

```env
# .env file
NODE_ENV=production
PORT=3001
DB_PATH=/app/data/recipes.db
UPLOAD_PATH=/app/public/images
```

## Production Setup with SSL

1. **Prepare SSL certificates**:
   ```bash
   mkdir ssl
   # Add your cert.pem and key.pem files to ssl/ directory
   ```

2. **Start with nginx**:
   ```bash
   docker-compose -f docker-compose.prod.yml --profile with-nginx up -d
   ```

3. **Access your application**:
   - HTTP: `http://your-domain.com` (redirects to HTTPS)
   - HTTPS: `https://your-domain.com`

## Monitoring and Maintenance

### Health Checks
All configurations include health checks that test the application endpoint every 30 seconds.

### Log Management
```bash
# View recent logs
docker-compose logs --tail=100 -f

# Clear logs (if they get too large)
docker-compose down
docker system prune -a
```

### Updates
```bash
# Update to latest image (production)
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Rebuild local changes (development)
docker-compose up -d --build
```

## Troubleshooting

### Port Conflicts
If port 3001 or 80 is already in use:
```yaml
ports:
  - "8080:3001"  # Change external port
```

### Database Issues
```bash
# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d

# Access database directly
docker-compose exec recipe-manager sqlite3 /app/data/recipes.db
```

### SSL Certificate Issues
For development SSL testing:
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```