# ==============================================================================
# JobEaseAI Production Container
# Includes Node.js LTS + Linux Tectonic LaTeX Compiler Engine
# ==============================================================================

FROM node:20-slim

# Install system dependencies & Tectonic LaTeX engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    ca-certificates \
    fontconfig \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu72 \
    && wget -qO- "https://drop-sh.fullyjustified.net" | sh \
    && mv tectonic /usr/local/bin/ \
    && chmod +x /usr/local/bin/tectonic \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify Tectonic installation
RUN tectonic --version

# Set application directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start Node.js server
CMD ["node", "server.js"]
