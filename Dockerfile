# Use stable lightweight Node.js base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies for a lightweight image
RUN npm ci --only=production

# Copy application source files
COPY . .

# Expose port (corresponds to server.js port)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Start Express server
CMD ["node", "server.js"]
