# ==============================================================================
# Frontend Nginx Non-Root Production Image
# ==============================================================================
FROM nginxinc/nginx-unprivileged:1.25-alpine-slim

LABEL org.opencontainers.image.title="car-serv-frontend" \
      org.opencontainers.image.description="Tier-1 Presentation Layer & Reverse Proxy"

USER root

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*

COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY frontend/src /usr/share/nginx/html

RUN chown -R 101:101 /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx

USER 101

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
