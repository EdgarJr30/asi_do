#!/usr/bin/env bash

set -Eeuo pipefail

artifact_dir=${1:-dist}
deploy_origin=${2:?Usage: deploy-hostinger-release.sh <artifact-dir> <https-origin>}

for variable_name in HOSTINGER_HOST HOSTINGER_PASSWORD HOSTINGER_PORT HOSTINGER_USERNAME; do
  if [[ -z ${!variable_name:-} ]]; then
    echo "Missing required environment variable: $variable_name" >&2
    exit 1
  fi
done

if [[ ! $deploy_origin =~ ^https://[^/]+$ ]]; then
  echo "Deploy origin must be an HTTPS origin without a trailing slash: $deploy_origin" >&2
  exit 1
fi

if [[ $artifact_dir == /* || $artifact_dir == *..* || ! $artifact_dir =~ ^[a-zA-Z0-9._/-]+$ ]]; then
  echo "Artifact directory must be a relative repository path: $artifact_dir" >&2
  exit 1
fi

if [[ ! $HOSTINGER_PORT =~ ^[0-9]+$ ]]; then
  echo "HOSTINGER_PORT must be numeric" >&2
  exit 1
fi

for required_file in .htaccess index.html sw.js; do
  if [[ ! -f $artifact_dir/$required_file ]]; then
    echo "Missing deployable file: $artifact_dir/$required_file" >&2
    exit 1
  fi
done

rollback_dir=$(mktemp -d)
entrypoints_activated=false

cleanup() {
  rm -rf "$rollback_dir"
}

run_lftp() {
  local commands=$1
  local attempt
  local max_attempts=3

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    if lftp -u "$HOSTINGER_USERNAME","$HOSTINGER_PASSWORD" \
      -p "$HOSTINGER_PORT" "$HOSTINGER_HOST" -e "
        set cmd:fail-exit yes;
        set ftp:ssl-force true;
        set ftp:ssl-protect-data true;
        set ssl:verify-certificate yes;
        set ssl:check-hostname no;
        set net:max-retries 3;
        set net:timeout 60;
        set net:reconnect-interval-base 5;
        set net:reconnect-interval-max 15;
        set xfer:use-temp-file yes;
        set xfer:temp-file-name .deploying.*;
        $commands
        bye
      "; then
      return 0
    fi

    if ((attempt == max_attempts)); then
      echo "FTPS operation failed after $max_attempts sessions." >&2
      return 1
    fi

    echo "Retrying FTPS operation with a fresh session ($((attempt + 1))/$max_attempts)." >&2
    sleep $((attempt * 10))
  done
}

backup_entrypoint() {
  local filename=$1
  local cache_buster=${GITHUB_SHA:-manual}-${GITHUB_RUN_ATTEMPT:-0}

  curl --fail --silent --show-error --location \
    --retry 5 --retry-all-errors --retry-delay 2 \
    --connect-timeout 20 --max-time 90 \
    --header 'Accept-Encoding: identity' \
    --header 'Cache-Control: no-cache' \
    "$deploy_origin/$filename?deploy-backup=$cache_buster" \
    --output "$rollback_dir/$filename"
}

rollback_on_error() {
  local exit_code=$?
  trap - ERR

  if [[ $entrypoints_activated == true ]]; then
    echo "Deployment verification failed. Restoring the previous entrypoints." >&2

    if ! run_lftp "
      put $rollback_dir/index.html -o index.html;
      put $rollback_dir/sw.js -o sw.js;
    "; then
      echo "Automatic rollback failed; restore index.html and sw.js from the deploy artifact." >&2
    fi
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap rollback_on_error ERR

# A rollback only needs the two public entrypoints. Read them over HTTPS instead
# of spending a fragile FTPS session on files that the web server already exposes.
backup_entrypoint index.html
backup_entrypoint sw.js

test -s "$rollback_dir/index.html"
test -s "$rollback_dir/sw.js"

# Phase 1: hashed assets are append-only. Uploading only missing files means an
# active release can keep requesting its old chunks throughout the deployment.
run_lftp "
  pwd;
  cls -la;
  mirror --reverse --only-missing --continue --verbose --parallel=1 --no-perms \
    $artifact_dir/assets/ assets/;
"

# Phase 2: replace non-entrypoint static files through same-directory temporary
# names. index.html and sw.js are deliberately excluded until every dependency
# of the new release is available.
run_lftp "
  mirror --reverse --continue --verbose --parallel=1 --no-perms --overwrite \
    --exclude-glob assets/ --exclude-glob index.html --exclude-glob sw.js \
    $artifact_dir/ .;
"

node scripts/verify-hostinger-release.mjs assets "$artifact_dir" "$deploy_origin"

# Phase 3: activate the HTML first and the service worker last. lftp uploads to
# a temporary sibling and renames it, so readers never observe a partial file.
entrypoints_activated=true
run_lftp "put $artifact_dir/index.html -o index.html;"
run_lftp "put $artifact_dir/sw.js -o sw.js;"

node scripts/verify-hostinger-release.mjs live "$artifact_dir" "$deploy_origin"

entrypoints_activated=false
echo "Hostinger release activated and verified at $deploy_origin"
