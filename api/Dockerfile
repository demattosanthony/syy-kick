FROM oven/bun:1.2.9 AS base
WORKDIR /usr/src/app

# Install ghostscript and imagemagick
RUN apt-get update && \
    apt-get install -y ghostscript imagemagick ffmpeg exiftool git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python 3.10 and pip
RUN apt-get update && \
    apt-get install -y build-essential zlib1g-dev libncurses5-dev libgdbm-dev libnss3-dev libssl-dev libreadline-dev libffi-dev wget && \
    wget https://www.python.org/ftp/python/3.10.13/Python-3.10.13.tgz && \
    tar -xf Python-3.10.13.tgz && \
    cd Python-3.10.13 && \
    ./configure --enable-optimizations && \
    make -j$(nproc) && \
    make altinstall && \
    cd .. && rm -rf Python-3.10.13* && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
    
# Install MarkItDown from source with all dependencies
RUN git clone https://github.com/microsoft/markitdown.git /tmp/markitdown && \
    cd /tmp/markitdown && \
    python3.10 -m pip install "packages/markitdown[all]" && \
    rm -rf /tmp/markitdown

# Add PATH modifications
ENV PATH="/usr/local/bin:/root/.local/bin:${PATH}"

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
# Install markitdown globally
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/. .

ENV NODE_ENV=production

# run the app
USER bun
EXPOSE 4000/tcp
ENTRYPOINT [ "bun", "run", "start" ]