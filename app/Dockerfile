FROM node:22-alpine AS builder

WORKDIR /app

RUN apk update && apk upgrade --no-cache

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
RUN yarn add -D @types/node

COPY . .
RUN yarn build

FROM nginx:stable-alpine AS production
RUN apk update && apk upgrade --no-cache

LABEL maintainer="Anmol Baral"
LABEL version="1.0.0"
LABEL build-date="2025-05-23"
LABEL org.opencontainers.image.revision="e30f4e8"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.architecture="amd64"
LABEL org.opencontainers.image.source="https://github.com/Anmolbaral/ProfileBuilder"
LABEL org.opencontainers.image.vendor="Anmol Baral"
LABEL org.opencontainers.image.title="PDF Extractor Frontend"
LABEL org.opencontainers.image.license="MIT"
LABEL org.opencontainers.image.created="2025-05-23T15:47:34Z"
LABEL org.opencontainers.image.documentation="https://github.com/Anmolbaral/ProfileBuilder#readme"
LABEL org.opencontainers.image.url="https://github.com/Anmolbaral/ProfileBuilder"
LABEL org.opencontainers.image.base.name="nginx:stable-alpine"
LABEL org.opencontainers.image.base.digest="sha256:1234567890abcdef"
LABEL description="PDF Extractor Frontend"
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Install envsubst
RUN apk add --no-cache gettext

# Debug: List and show template contents
RUN ls -l /etc/nginx/templates && cat /etc/nginx/templates/default.conf.template

# Create startup script
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"] 