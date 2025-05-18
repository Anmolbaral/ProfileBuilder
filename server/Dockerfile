FROM node:20-alpine

WORKDIR /server

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

ENV PORT=8080
EXPOSE ${PORT}

CMD ["yarn", "dev"] 