#!/bin/bash
# Execute from root dir like this:
# ./script/upload_and_run.sh 10.19.3.134 100 3

set -e
HOST=$1
NUM_CONFERENCES=$2
NUM_PARTICIPANTS=$3

if [ -z $HOST ] || [ -z $NUM_CONFERENCES ] || [ -z $NUM_PARTICIPANTS ]; then
  echo "check your args"
  exit 1
fi
if [ -z $SSH_CONFIG_PATH ]; then
  echo "SSH_CONFIG_PATH env var must be set"
  exit 1
fi
if [ -z $SSH_USERNAME ]; then
  echo "SSH_USERNAME env var must be set"
  exit 1
fi

npm run build
scp -F $SSH_CONFIG_PATH dist/main.js $SSH_USERNAME@$HOST:~/
ssh -F $SSH_CONFIG_PATH $SSH_USERNAME@$HOST "node ./main.js ./config.json $NUM_CONFERENCES $NUM_PARTICIPANTS"
