# Use Node.js as the base image
FROM node:18.13.0

# Switch to root user (default) to install packages and change permissions
USER root

# Install PostgreSQL and necessary utilities
RUN apt-get update && apt-get install -y postgresql postgresql-contrib telnet

# Expose the PostgreSQL default port
EXPOSE 5432

# Set PostgreSQL environment variables
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres123
ENV POSTGRES_DB=neubird_custom

# Fix permissions of /var/run/postgresql (ensure PostgreSQL directory is accessible)
RUN mkdir -p /var/run/postgresql && \
    chown -R postgres:postgres /var/run/postgresql && \
    chmod 700 /var/run/postgresql

# Setup PM2 directory structure and set permissions (run as root user)
RUN mkdir -p /home/ubuntu/.pm2/logs && \
    chown -R ubuntu:ubuntu /home/ubuntu && \
    chmod -R 700 /home/ubuntu/.pm2

# Create necessary directories for PM2 logs and set correct ownership/permissions
RUN mkdir -p /home/ubuntu/neubird-slack-custom/logs && \
    chown -R ubuntu:ubuntu /home/ubuntu/neubird-slack-custom/logs

# Install PM2 globally
RUN npm install -g pm2@5.2.2

# Switch to non-root user (ubuntu) to run the app
USER ubuntu

# Set the working directory for the application
WORKDIR /home/ubuntu/neubird-slack-custom

# Copy application files and set correct ownership
COPY --chown=ubuntu:ubuntu dist/ ./dist
COPY --chown=ubuntu:ubuntu .env .env
COPY --chown=ubuntu:ubuntu package.json package-lock.json ./
COPY --chown=ubuntu:ubuntu node_modules/ ./node_modules
COPY --chown=ubuntu:ubuntu .npmrc .npmrc
COPY --chown=ubuntu:ubuntu public/ /home/ubuntu/neubird-slack-custom/public/

# Set permissions for .env file
RUN chmod -R 666 /home/ubuntu/neubird-slack-custom/.env

# Expose the application port (Node.js app port)
EXPOSE 7112

# Start PostgreSQL service and the Node.js app using PM2
CMD service postgresql start && pm2-runtime start npm -- run start:pm2
