FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    libreoffice \
    fontconfig \
    ttf-dejavu \
    msttcorefonts-installer || true

RUN update-ms-fonts || true
RUN fc-cache -f || true

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]