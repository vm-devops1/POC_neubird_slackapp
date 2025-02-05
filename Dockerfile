# Use Node.js as the base image
FROM node:18.13.0

# Switch to root user
USER root

# Install PostgreSQL dependencies
RUN apt-get update && apt-get install -y \
    postgresql postgresql-contrib \
    telnet \
    && apt-get clean

# Create a non-root user (ubuntu) to prevent security risks
RUN adduser --disabled-password --gecos '' ubuntu \
    && usermod -aG sudo ubuntu

# Create PM2 directory structure and set ownership/permissions
RUN mkdir -p /home/ubuntu/.pm2/logs \
    && chown -R ubuntu:ubuntu /home/ubuntu \
    && chmod -R 700 /home/ubuntu/.pm2

# Create necessary directories for PM2 logs and set correct ownership/permissions
RUN mkdir -p /home/ubuntu/neubird-slack-custom/logs && \
    chown -R ubuntu:ubuntu /home/ubuntu/neubird-slack-custom/logs

# Install PM2 globally as root to ensure it's available system-wide for managing Node.js processes
RUN npm install -g pm2@5.2.2


# Set the working directory for the application
WORKDIR /home/ubuntu/neubird-slack-custom

# Copy application files and set the correct ownership
COPY --chown=ubuntu:ubuntu dist/ ./dist
COPY --chown=ubuntu:ubuntu .env .env
COPY --chown=ubuntu:ubuntu package.json package-lock.json ./ 
COPY --chown=ubuntu:ubuntu node_modules/ ./node_modules
COPY --chown=ubuntu:ubuntu .npmrc .npmrc
COPY --chown=ubuntu:ubuntu public/ /home/ubuntu/neubird-slack-custom/public/

# Make the .env file accessible
RUN chmod -R 777 /home/ubuntu/neubird-slack-custom/.env

# Set PostgreSQL environment variables (you can modify these based on your needs)
ENV DB_HOST=localhost
ENV DB_PASSWORD=postgres123
ENV DB_NAME=neubird_custom
ENV DB_type=postgres
ENV DB_PORT=5432

# Expose application port and PostgreSQL port
EXPOSE 7112
EXPOSE 5432

# Start PostgreSQL service and the app using pm2
CMD service postgresql start && pm2-runtime start npm -- run start:pm2
