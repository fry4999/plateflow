#!/bin/zsh
cd /Users/diego/Documents/Codex/2026-05-07/files-mentioned-by-the-user-laser
export APP_BASE_URL="${APP_BASE_URL:-http://localhost:4321}"
export SESSION_SECRET="${SESSION_SECRET:-abcdefghijklmnopqrstuvwxyz0123456789}"
exec /Users/diego/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
