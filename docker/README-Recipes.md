# Recipe Management with Docker

The Recipe Manager Docker setup now supports configurable recipe directories, making it container-friendly and eliminating the need to rebuild the image when adding new recipes.

## Quick Setup

### 1. Prepare Your Recipes Directory

Create a directory with your recipe files:
```bash
mkdir -p ~/my-recipes
# Copy your .md recipe files to this directory
cp /path/to/your/recipes/*.md ~/my-recipes/
```

### 2. Run with Custom Recipes

#### Option A: Direct Docker Command
```bash
docker run -p 3001:3001 \
  -v ~/my-recipes:/app/recipes \
  -v recipe_data:/app/data \
  lukemartinlogan/recipe-manager:latest
```

#### Option B: Docker Compose (Recommended)
```bash
cd docker

# Create environment file
cp .env.example .env
# Edit .env and set RECIPES_SOURCE to your recipes directory

# Run with custom recipes
docker-compose -f docker-compose.recipes.yml up -d
```

#### Option C: Custom Path
```bash
cd docker
RECIPES_SOURCE=/path/to/your/recipes docker-compose -f docker-compose.recipes.yml up -d
```

## Configuration Options

### Environment Variables

- `RECIPES_PATH`: Path inside container (default: `/app/recipes`)
- `RECIPES_SOURCE`: Path on host system (configurable)
- `NODE_ENV`: Application environment
- `PORT`: Application port (default: 3001)

### Volume Mounts

The container expects recipes to be mounted at `/app/recipes`. You can mount:

- **Local directory**: `-v ~/my-recipes:/app/recipes`
- **Network share**: `-v /mnt/shared/recipes:/app/recipes`
- **Git repository**: Use init containers or external sync

## Recipe File Format

Recipes should be markdown files (`.md`) with the format used by your application:

```markdown
# Recipe Name

## Ingredients
- [ ] $ingredient_name = quantity$
- [ ] $another_ingredient = amount$

## Steps
1. First step
2. Second step
```

## Adding New Recipes

### Method 1: Direct File Addition
1. Add new `.md` files to your mounted recipes directory
2. Restart the container: `docker-compose restart recipe-manager`

### Method 2: Hot Reload (Development)
```bash
# Use local development setup for hot reload
cd docker
docker-compose -f docker-compose.local.yml up -d
```

### Method 3: Git Sync (Advanced)
Set up a cron job or init container to sync from a Git repository:

```bash
# Example cron job to sync recipes every hour
0 * * * * cd /path/to/recipes && git pull origin main
```

## Example Setups

### Personal Recipe Collection
```bash
# Store recipes in your home directory
mkdir -p ~/Documents/recipes
docker run -p 3001:3001 \
  -v ~/Documents/recipes:/app/recipes \
  -v recipe_data:/app/data \
  lukemartinlogan/recipe-manager:latest
```

### Shared Team Recipes
```bash
# Mount shared network drive
docker run -p 3001:3001 \
  -v /mnt/shared/team-recipes:/app/recipes \
  -v recipe_data:/app/data \
  lukemartinlogan/recipe-manager:latest
```

### Development with Live Recipes
```bash
# Development with both code and recipes editable
cd docker
docker-compose -f docker-compose.local.yml up -d
```

## Docker Compose Configurations

### Standard (with local recipes)
```yaml
# docker-compose.yml - mounts ../recipes
services:
  recipe-manager:
    volumes:
      - ../recipes:/app/recipes
```

### Flexible (configurable source)
```yaml
# docker-compose.recipes.yml - uses RECIPES_SOURCE env var
services:
  recipe-manager:
    volumes:
      - ${RECIPES_SOURCE:-./recipes}:/app/recipes
```

### Production (specific path)
```yaml
# docker-compose.prod.yml - mounts ./recipes
services:
  recipe-manager:
    volumes:
      - ./recipes:/app/recipes
```

## Troubleshooting

### No Recipes Found
If you see "Warning: No recipes found", check:
1. Recipes directory exists and contains `.md` files
2. Volume mount is correct
3. File permissions allow container to read files

### Verify Mount
```bash
# Check mounted recipes inside container
docker exec -it recipe-manager-container ls -la /app/recipes

# Check logs for recipe count
docker logs recipe-manager-container
```

### Permission Issues
```bash
# Fix permissions if needed
chmod -R 755 ~/my-recipes
```

## Benefits

- ✅ **No Rebuilds**: Add recipes without rebuilding Docker images
- ✅ **Flexible Storage**: Mount from any local or network path
- ✅ **Team Sharing**: Multiple containers can share the same recipe source
- ✅ **Backup Friendly**: Recipes are separate from application data
- ✅ **Version Control**: Keep recipes in Git independently from app code