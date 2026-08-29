# Use Node 20 LTS with full build tools pre-installed
FROM node:20-slim

# Install build dependencies required for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install dependencies (this compiles better-sqlite3 native addon cleanly)
RUN npm ci --build-from-source

# Copy the rest of the application code
COPY . .

# Expose port (Render auto-detects this)
EXPOSE 3000

# Start the server
CMD ["node", "server/src/index.js"]
