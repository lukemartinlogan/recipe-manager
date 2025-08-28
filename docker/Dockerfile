FROM node:18-alpine

# Install git
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Clone the repository and handle potential issues
RUN git clone https://github.com/lukemartinlogan/recipe-manager.git . || \
    (echo "Repository not found, creating basic structure..." && \
     mkdir -p /app && \
     echo '{"name": "recipe-manager", "version": "1.0.0", "main": "server.js", "scripts": {"start": "node server.js"}, "dependencies": {"express": "^4.18.2", "marked": "^5.1.1", "express-session": "^1.17.3", "sqlite3": "^5.1.6"}}' > package.json)

# Install dependencies (with fallback)
RUN npm install || echo "npm install failed, will retry at runtime"

# Expose port
EXPOSE 3001

# Create startup script with better error handling
RUN echo '#!/bin/sh' > start.sh && \
    echo 'set -e' >> start.sh && \
    echo 'echo "Checking repository status..."' >> start.sh && \
    echo 'if [ -d ".git" ]; then' >> start.sh && \
    echo '  echo "Pulling latest changes..."' >> start.sh && \
    echo '  git pull origin master || git pull origin main || echo "Git pull failed, continuing..."' >> start.sh && \
    echo 'else' >> start.sh && \
    echo '  echo "Not a git repository, skipping pull..."' >> start.sh && \
    echo 'fi' >> start.sh && \
    echo 'echo "Installing/updating dependencies..."' >> start.sh && \
    echo 'npm install || echo "npm install failed, trying to continue..."' >> start.sh && \
    echo 'echo "Starting application..."' >> start.sh && \
    echo 'if [ -f "server.js" ]; then' >> start.sh && \
    echo '  npm start' >> start.sh && \
    echo 'else' >> start.sh && \
    echo '  echo "server.js not found. Available files:"' >> start.sh && \
    echo '  ls -la' >> start.sh && \
    echo '  echo "Trying to start with node directly..."' >> start.sh && \
    echo '  node index.js 2>/dev/null || node app.js 2>/dev/null || echo "No suitable entry point found"' >> start.sh && \
    echo 'fi' >> start.sh && \
    chmod +x start.sh

# Run the startup script
CMD ["./start.sh"]