FROM node:20-slim

WORKDIR /app

# Install OpenSSL
RUN apt-get update -y && apt-get install -y openssl

# Copy package files
COPY server/package*.json ./
COPY server/prisma ./prisma/
COPY server/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY server/src ./src

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Verify build output
RUN ls -la dist/

# Expose port
EXPOSE 4000

# Start the server
CMD ["npm", "start"] 