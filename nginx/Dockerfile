FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy SSL certificates
RUN mkdir -p /etc/nginx/certs /etc/nginx/ssl
COPY certs/server.crt /etc/nginx/certs/server.crt
COPY certs/server.key /etc/nginx/certs/server.key
COPY ssl/cert.pem /etc/nginx/ssl/cert.pem
COPY ssl/key.pem /etc/nginx/ssl/key.pem

# Set permissions for SSL files
RUN chmod 600 /etc/nginx/certs/server.key /etc/nginx/ssl/key.pem && \
    chmod 644 /etc/nginx/certs/server.crt /etc/nginx/ssl/cert.pem

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://127.0.0.1/nginx_status || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
