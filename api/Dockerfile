FROM oven/bun:1.2.0 AS base
WORKDIR /usr/src/app

# Install ghostscript and imagemagick
RUN apt-get update && \
    apt-get install -y ghostscript imagemagick && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pip
RUN apt-get update && \
    apt-get install -y python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install markitdown
RUN pip install markitdown          

# install dependencies into temp directory
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy everything and build
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# build
ENV NODE_ENV=production
RUN bun run build

# final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/. .

ENV NODE_ENV=production
ENV PATH="/usr/local/bin:${PATH}"

# run the app
USER bun
EXPOSE 4000/tcp
ENTRYPOINT [ "bun", "run", "start" ]