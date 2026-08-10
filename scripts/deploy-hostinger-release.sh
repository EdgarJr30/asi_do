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

  lftp -u "$HOSTINGER_USERNAME","$HOSTINGER_PASSWORD" \
    -p "$HOSTINGER_PORT" "$HOSTINGER_HOST" -e "
      set cmd:fail-exit yes;
      set ftp:ssl-force true;
      set ftp:ssl-protect-data true;
      set ssl:verify-certificate yes;
      set ssl:check-hostname no;
      set net:max-retries 5;
      set net:timeout 60;
      set net:reconnect-interval-base 5;
      set net:reconnect-interval-max 15;
      set xfer:use-temp-file yes;
      set xfer:temp-file-name .deploying.*;
      $commands
      bye
    "
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

# A rollback only needs the two mutable entrypoints. Immutable hashed assets from
# the previous release stay available remotely for already-open browser tabs.
run_lftp "
  get index.html -o $rollback_dir/index.html;
  get sw.js -o $rollback_dir/sw.js;
"

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
