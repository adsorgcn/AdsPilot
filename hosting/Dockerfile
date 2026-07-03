FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . ./

ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
CMD ["npm","start"]
