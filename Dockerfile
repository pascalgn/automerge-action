FROM node:11-alpine

LABEL "com.github.actions.name"="Merge pull requests"
LABEL "com.github.actions.description"="Automatically merge pull requests that are ready"
LABEL "com.github.actions.icon"="git-pull-request"
LABEL "com.github.actions.color"="blue"

RUN apk add --no-cache git openssl

COPY . /tmp/src/

RUN yarn global add "file:/tmp/src" && rm -rf /tmp/src

ENTRYPOINT [ "automerge-action" ]
