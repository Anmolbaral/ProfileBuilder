FROM node:22-alpine

WORKDIR /app

# Install OpenSSL and security updates
RUN apk update && \
    apk add --no-cache openssl && \
    apk upgrade

# Copy package files
COPY server/package*.json ./
COPY server/prisma ./prisma/
COPY server/tsconfig.json ./
COPY server/src/schema.graphql ./

# Install dependencies with security fixes
RUN npm install && \
    npm audit fix --force

# Copy source code
COPY server/src ./src

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Copy schema to dist
RUN cp schema.graphql dist/

# Verify build output
RUN ls -la dist/

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'npx prisma migrate reset --force' >> /app/start.sh && \
    echo 'npx prisma migrate deploy' >> /app/start.sh && \
    echo 'npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 8080

# Start the server
CMD ["/app/start.sh"] 