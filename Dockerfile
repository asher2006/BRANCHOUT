# ---- Stage 1: Build ----
FROM node:22-slim AS build

WORKDIR /app
RUN mkdir -p /data

# Copy root package files
COPY package.json ./

# Copy frontend
COPY frontend/package.json frontend/
COPY frontend/ frontend/

# Copy backend
COPY backend/package.json backend/
COPY backend/ backend/

# Install and build frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Install and build backend
WORKDIR /app/backend
RUN npm install
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:22-slim

WORKDIR /app
RUN mkdir -p /data

# Copy compiled backend
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/dist ./backend/dist

# Copy frontend static build
COPY --from=build /app/frontend/dist ./frontend/dist

# Install production-only backend deps
WORKDIR /app/backend
RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/branchout.db

VOLUME ["/data"]

EXPOSE 3001

CMD ["node", "dist/server.js"]
