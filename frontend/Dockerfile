# ---------- Stage 1: Build the app ----------
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the React app for production
RUN npm run build

# ---------- Stage 2: Serve the build ----------
FROM node:20-alpine AS production

# Install serve (static file server)
RUN npm install -g serve

WORKDIR /app

# Copy built files from the build stage
COPY --from=build /app/build ./build

# Expose port 3000 (React default)
EXPOSE 3000

# Start the app
CMD ["serve", "-s", "build", "-l", "3000"]
