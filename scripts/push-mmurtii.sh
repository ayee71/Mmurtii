#!/usr/bin/env bash
set -euo pipefail

# Manual batched Git push helper for ayee71/Mmurtii
# Handles intermittent connections and avoids large single-commit 503 timeouts.

REPO_URL="${MMURTII_REPO_URL:-https://github.com/ayee71/Mmurtii.git}"
BRANCH="${MMURTII_BRANCH:-main}"
BATCH_SIZE="${BATCH_SIZE:-80}"
MAX_RETRIES="${MAX_RETRIES:-5}"

echo "=== SeeraAI Pro -> ayee71/Mmurtii Resilient Push Helper ==="

if [ ! -d ".git" ]; then
  echo "Initializing local git repository on branch '$BRANCH'..."
  git init -b "$BRANCH"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

# Improve stability on intermittent or mobile networks
git config http.postBuffer 524288000
git config http.lowSpeedLimit 1000
git config http.lowSpeedTime 60

# Pull remote main cleanly if it already exists
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Syncing remote branch '$BRANCH' metadata..."
  git fetch origin "$BRANCH"
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    git merge --no-edit "origin/$BRANCH" || {
      echo "Merge conflict detected. Resolve conflicts, commit, and re-run."
      exit 1
    }
  else
    git reset --soft "origin/$BRANCH" || true
  fi
fi

push_with_retry() {
  local attempt=1
  local delay=5
  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    echo "Pushing to origin/$BRANCH (attempt $attempt/$MAX_RETRIES)..."
    if git push -u origin "$BRANCH"; then
      echo "Push succeeded."
      return 0
    fi
    echo "Push failed (likely transient network or 503 service unavailable). Retrying in ${delay}s..."
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
  echo "ERROR: Push failed after $MAX_RETRIES attempts. Re-run this script to resume from the last pushed batch."
  return 1
}

# Collect modified/untracked files honoring .gitignore
mapfile -t PENDING_FILES < <(git ls-files --modified --others --exclude-standard)

if [ "${#PENDING_FILES[@]}" -eq 0 ]; then
  echo "No uncommitted file changes. Verifying remote is up to date..."
  push_with_retry
  exit 0
fi

echo "Found ${#PENDING_FILES[@]} pending files. Pushing in batches of $BATCH_SIZE..."

total="${#PENDING_FILES[@]}"
batch_num=1
i=0
while [ "$i" -lt "$total" ]; do
  end=$((i + BATCH_SIZE))
  if [ "$end" -gt "$total" ]; then
    end="$total"
  fi

  batch_files=("${PENDING_FILES[@]:i:BATCH_SIZE}")
  git add -- "${batch_files[@]}"

  if ! git diff --cached --quiet; then
    git commit -m "chore(sync): batch $batch_num ($((i + 1))-$end of $total files)"
    push_with_retry
  fi

  i="$end"
  batch_num=$((batch_num + 1))
done

echo "All $total files successfully synced to $REPO_URL ($BRANCH)."
