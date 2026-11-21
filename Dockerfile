FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 HOST=0.0.0.0 DEMO_PAYMENTS_ENABLED=false
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
