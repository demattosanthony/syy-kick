FROM node:23-alpine AS base
WORKDIR /usr/src/app

# Install system dependencies for Alpine
RUN apk add --no-cache \
    tzdata \
    ghostscript \
    imagemagick \
    ffmpeg \
    exiftool \
    git \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set the timezone
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Add PATH modifications
ENV PATH="/usr/local/bin:/root/.local/bin:${PATH}"

# Install dependencies into temp directory
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json package-lock.json /temp/dev/
RUN cd /temp/dev && npm install --legacy-peer-deps

RUN mkdir -p /temp/prod
COPY package.json package-lock.json /temp/prod/
RUN cd /temp/prod && npm install --legacy-peer-deps --production

# Copy everything and build
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Build the application
ENV NODE_ENV=production
RUN npm run build

# Final production image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/.mastra .mastra
COPY --from=prerelease /usr/src/app/package.json ./package.json

# Create node user and set ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mastra -u 1001 && \
    chown -R mastra:nodejs /usr/src/app

ENV NODE_ENV=production

# Switch to non-root user
USER mastra

# Expose port
EXPOSE 4111

# Run the application
ENTRYPOINT ["node", "--import", "dotenv/config", "--import", "./.mastra/output/instrumentation.mjs", ".mastra/output/index.mjs"]