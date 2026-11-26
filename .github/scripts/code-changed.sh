#!/usr/bin/env bash
# Prints "true" when a change touches anything other than documentation, "false" when it is documentation only.
# Usage: code-changed.sh <base-sha> <head-sha>
#
# Documentation only = every changed file is under docs/ or agents/, or is a Markdown file. Anything else counts as
# code, including .github/ (a workflow change must run the image and E2E jobs). Unsure means true: a missing argument
# or a diff that cannot be computed prints "true", so the expensive jobs are never skipped by mistake.
# --no-renames lists both the old and the new path of a moved file, so moving code into docs/ still counts as code.
set -u
base="${1:-}"
head="${2:-}"
if [ -z "$base" ] || [ -z "$head" ]; then
  echo true
  exit 0
fi
if ! files=$(git diff --name-only --no-renames "$base...$head" 2>/dev/null) || [ -z "$files" ]; then
  echo true
  exit 0
fi
while IFS= read -r file; do
  case "$file" in
    docs/* | agents/* | *.md) ;;
    *)
      echo true
      exit 0
      ;;
  esac
done <<< "$files"
echo false
