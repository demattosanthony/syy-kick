# Use Node.js base image
FROM oven/bun:1.2.6

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Create public directory before install to allow postinstall scripts to use it
RUN mkdir public

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Copy PDF worker file as specified in postinstall script
RUN cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js public/

# Expose port 4001 (matches dev script port)
EXPOSE 4001

# Start development server
CMD ["bun", "run", "dev"]
