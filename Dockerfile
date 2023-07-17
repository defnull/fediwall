FROM node:18-alpine as BUILD

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY ./ ./
RUN npm run build

FROM nginx
COPY --from=BUILD /build/dist /usr/share/nginx/html
