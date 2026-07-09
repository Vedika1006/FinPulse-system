FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Vite inlines env vars at BUILD time, not runtime — VITE_API_URL must be
# passed as a build ARG (see docker-compose.yml) so frontend/src/api/axios.js's
# import.meta.env.VITE_API_URL resolves correctly in the built bundle.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build for production
RUN npm run build

# Serve with a lightweight static server
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
