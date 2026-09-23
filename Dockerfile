# ==============================================================================
# JobEaseAI Production Container
# Uses Ubuntu 24.04 (GLIBC 2.39) + Node.js 20 LTS + Linux Tectonic LaTeX Engine
# ==============================================================================

FROM ubuntu:24.04

# Avoid interactive dialogs during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies, Node.js 20, and Tectonic LaTeX engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu74 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh -s - --to /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify Node.js and Tectonic installations
RUN node --version
RUN tectonic --version

# Set application working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies (if any)
RUN npm ci --only=production || npm install --production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start JobEaseAI Node.js server
CMD ["node", "server.js"]
