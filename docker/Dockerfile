FROM node:18-alpine

# Install git and other useful tools
RUN apk add --no-cache git curl wget

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Create startup script that handles external application mounting
RUN echo '#!/bin/sh' > /usr/local/bin/start-recipe-manager.sh && \
    echo 'set -e' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'echo "🍳 Recipe Manager Container Starting..."' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '# Check if application is mounted' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'if [ ! -f "/app/server.js" ]; then' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "❌ No application found at /app"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "Please mount your recipe-manager repository to /app"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "Example: docker run -v /path/to/recipe-manager:/app recipe-manager"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  exit 1' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'fi' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '# Check package.json and install dependencies' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'if [ -f "/app/package.json" ]; then' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "📦 Installing/updating dependencies..."' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  npm install || echo "⚠️  npm install failed, trying to continue..."' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'else' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "⚠️  No package.json found"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'fi' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '# Check for recipes directory' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'if [ -d "/app/recipes" ]; then' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  RECIPE_COUNT=$(ls /app/recipes/*.md 2>/dev/null | wc -l)' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "📚 Found $RECIPE_COUNT recipe files"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'else' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "⚠️  No recipes directory found at /app/recipes"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'fi' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '# Start the application' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'echo "🚀 Starting Recipe Manager on port $PORT..."' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'if [ -f "/app/server.js" ]; then' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  exec npm start' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'else' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  echo "❌ server.js not found"' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  ls -la /app' >> /usr/local/bin/start-recipe-manager.sh && \
    echo '  exit 1' >> /usr/local/bin/start-recipe-manager.sh && \
    echo 'fi' >> /usr/local/bin/start-recipe-manager.sh && \
    chmod +x /usr/local/bin/start-recipe-manager.sh

# Run the startup script
CMD ["/usr/local/bin/start-recipe-manager.sh"]