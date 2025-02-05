# Use Node.js  as the base image
FROM node:18.13.0

# Switch to root user
USER root

# create a non-root user (ubuntu) to prevent security risks
RUN adduser --disabled-password --gecos '' ubuntu \
    && usermod -aG sudo ubuntu

# Create PM2 directory structure and set ownership/permissions
RUN mkdir -p /home/ubuntu/.pm2/logs \
    && chown -R ubuntu:ubuntu /home/ubuntu \
    && chmod -R 700 /home/ubuntu/.pm2

# Create necessary directories for PM2 logs and set correct ownership/permissions
RUN mkdir -p /home/ubuntu/neubird-slack-custom/logs && \
    chown -R ubuntu:ubuntu /home/ubuntu/neubird-slack-custom/logs

RUN apt-get update && apt-get install -y telnet
	
# Install PM2 globally as root to ensure it's available system-wide for managing Node.js processes
# PM2 is a process manager for Node.js applications. It ensures that the application keeps running, even after crashes, and makes it easy to manage and monitor Node.js apps.
RUN npm install -g pm2@5.2.2

# Switch to non-root user
USER ubuntu

# Set the working directory for the application
WORKDIR /home/ubuntu/neubird-slack-custom

# Copy application files and set the correct ownership
COPY --chown=ubuntu:ubuntu dist/ ./dist
COPY --chown=ubuntu:ubuntu .env .env
COPY --chown=ubuntu:ubuntu package.json package-lock.json ./
COPY --chown=ubuntu:ubuntu node_modules/ ./node_modules
COPY --chown=ubuntu:ubuntu .npmrc .npmrc
COPY --chown=ubuntu:ubuntu public/ /home/ubuntu/neubird-slack-custom/public/

RUN chmod -R 777 /home/ubuntu/neubird-slack-custom/.env

# Expose the application port
EXPOSE 7112

# Start the application using pm2 as a process manager
CMD ["pm2-runtime", "start", "npm", "--", "run", "start:pm2"]
