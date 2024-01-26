FROM node:20

WORKDIR /app/

RUN apt-get update && apt-get install -y --no-install-recommends build-essential libsecret-1-dev
COPY . /app/.

RUN yarn install --check-cache
RUN yarn run build:all

ENTRYPOINT [ "yarn", "start:prod" ]
