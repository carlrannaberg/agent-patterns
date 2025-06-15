#!/bin/bash
set -e

# Find the next issue number
LAST_ID=$(ls -1 issues/*.md | sed -n 's/issues\/\([0-9]\+\)-.*/\1/p' | sort -rn | head -n 1)
NEXT_ID=$((LAST_ID + 1))

# Get the issue title from the first argument
if [ -z "$1" ]; then
  echo "Usage: $0 \"<issue-title>\""
  exit 1
fi
TITLE_SLUG=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-' | sed 's/[^a-z0-9-]//g')
ISSUE_FILE="issues/${NEXT_ID}-${TITLE_SLUG}.md"
PLAN_FILE="docs/plan_${NEXT_ID}-${TITLE_SLUG}.md"

# Create issue file
cat > "$ISSUE_FILE" << EOL
# Issue ${NEXT_ID}: $1

## Requirement

## Acceptance Criteria

EOL

# Create plan file
cat > "$PLAN_FILE" << EOL
# Plan for Issue ${NEXT_ID}: $1

This document outlines the step-by-step plan to complete \`issues/${NEXT_ID}-${TITLE_SLUG}.md\`.

## Implementation Plan

- [ ]
EOL

# Add to todo.md
echo "- [ ] **[Issue #${NEXT_ID}]** $1 - \`${ISSUE_FILE}\`" >> todo.md

echo "Created:"
echo "  - ${ISSUE_FILE}"
echo "  - ${PLAN_FILE}"
echo "Updated todo.md"

# Open issue file in editor
if [ -n "$EDITOR" ]; then
  $EDITOR "$ISSUE_FILE"
fi
