FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Copy schema to dist directory
RUN cp src/schema.graphql dist/

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "start"] 