# External Application Docker Setup

This Docker setup treats the entire recipe-manager application as external to the container. The container provides only the Node.js runtime environment, while the application code is mounted from the host filesystem.

## Key Benefits

- ✅ **No Rebuilds**: Deploy container once, update code without rebuilding
- ✅ **Live Development**: Edit code on host, see changes immediately
- ✅ **Version Control**: Application code stays in your Git repository
- ✅ **Multiple Deployments**: One container image, multiple application versions
- ✅ **Easy Backup**: Application and data are clearly separated

## Container Architecture

```
Host System:                    Container:
/path/to/recipe-manager/   →   /app/
├── server.js              →   ├── server.js
├── package.json           →   ├── package.json  
├── recipes/               →   ├── recipes/
├── public/                →   ├── public/
└── data/ (persistent)     →   └── data/ (volume)
```

## Quick Start

### Method 1: Direct Docker Run
```bash
# Basic setup
docker run -p 3001:3001 \
  -v /path/to/recipe-manager:/app \
  -v recipe_data:/app/data \
  lukemartinlogan/recipe-manager:latest

# With custom database location  
docker run -p 3001:3001 \
  -v /path/to/recipe-manager:/app \
  -v /path/to/persistent/data:/app/data \
  lukemartinlogan/recipe-manager:latest
```

### Method 2: Docker Compose (Recommended)
```bash
cd docker

# Quick start (mounts parent directory)
docker-compose up -d

# Custom application path
APP_SOURCE=/path/to/recipe-manager docker-compose -f docker-compose.recipes.yml up -d

# Using .env file
cp .env.example .env
# Edit .env: APP_SOURCE=/path/to/recipe-manager
docker-compose -f docker-compose.recipes.yml up -d
```

## Configuration Options

### Environment Variables
- `APP_SOURCE`: Path to recipe-manager repository on host
- `NODE_ENV`: production, development, test
- `PORT`: Application port (default: 3001)

### Volume Mounts
- **Application**: `-v /host/path:/app` (entire codebase)
- **Database**: `-v recipe_data:/app/data` (persistent data)
- **Node modules**: `-v /app/node_modules` (prevents overwrite)

## Development Workflow

### 1. Clone Repository
```bash
git clone https://github.com/lukemartinlogan/recipe-manager.git
cd recipe-manager
```

### 2. Start Container
```bash
cd docker
docker-compose up -d
```

### 3. Develop
- Edit files in your local repository
- Changes are immediately available in the container
- Database persists across container restarts

### 4. Deploy Updates
```bash
# Pull latest changes
git pull origin main

# Restart container to pick up dependency changes
docker-compose restart recipe-manager
```

## Production Deployment

### Option 1: Git Clone on Server
```bash
# On production server
git clone https://github.com/lukemartinlogan/recipe-manager.git /opt/recipe-manager

# Run container
docker run -d -p 80:3001 \
  -v /opt/recipe-manager:/app \
  -v recipe_data_prod:/app/data \
  --restart unless-stopped \
  --name recipe-manager \
  lukemartinlogan/recipe-manager:latest
```

### Option 2: Docker Compose Production
```bash
# On production server
cd /opt/recipe-manager/docker
APP_SOURCE=/opt/recipe-manager docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: CI/CD Pipeline
```bash
# In your deployment script
git pull origin main
docker-compose restart recipe-manager
```

## File Structure

```
recipe-manager/                 # Your application repository
├── server.js                  # Main application
├── package.json               # Dependencies
├── recipes/                   # Recipe markdown files
├── public/                    # Static assets
├── data/                      # Database (mounted as volume)
└── docker/                    # Docker configurations
    ├── Dockerfile             # Runtime container only
    ├── docker-compose.yml     # Development setup
    ├── docker-compose.prod.yml # Production setup
    └── docker-compose.recipes.yml # Configurable setup
```

## Container Startup Process

1. **Mount Check**: Verifies application is mounted at `/app`
2. **Dependencies**: Runs `npm install` if package.json found
3. **Recipe Count**: Reports number of recipe files found
4. **Application Start**: Executes `npm start`

## Troubleshooting

### Application Not Found
```bash
❌ No application found at /app
Please mount your recipe-manager repository to /app
```
**Solution**: Ensure you're mounting the correct path containing `server.js`

### Permission Issues
```bash
# Fix file permissions
chmod -R 755 /path/to/recipe-manager
```

### Dependencies Not Installing
```bash
# Check if package.json exists in mounted directory
docker exec -it recipe-manager ls -la /app/

# Manually install dependencies
docker exec -it recipe-manager npm install
```

### Database Issues
```bash
# Check database volume
docker volume ls | grep recipe

# Access database directly
docker exec -it recipe-manager sqlite3 /app/data/recipes.db
```

## Multiple Environments

### Development
```bash
# Mount local development copy
docker run -v ./recipe-manager:/app -e NODE_ENV=development
```

### Staging
```bash
# Mount staging branch
git clone -b staging https://github.com/lukemartinlogan/recipe-manager.git /opt/staging
docker run -v /opt/staging:/app -e NODE_ENV=staging
```

### Production
```bash
# Mount production release
git clone -b main https://github.com/lukemartinlogan/recipe-manager.git /opt/production  
docker run -v /opt/production:/app -e NODE_ENV=production
```

## Backup Strategy

### Application Code
```bash
# Code is in your Git repository - no additional backup needed
git push origin main
```

### Database Only
```bash
# Backup just the data volume
docker run --rm -v recipe_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/recipe-data-backup.tar.gz -C /data .
```

### Full Backup
```bash
# Backup both application and data
tar czf recipe-manager-full-backup.tar.gz /path/to/recipe-manager
docker run --rm -v recipe_data:/data -v $(pwd):/backup alpine \
  cp -r /data /backup/database-backup
```

This approach gives you maximum flexibility while keeping the container lightweight and focused on providing the runtime environment.