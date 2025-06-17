#!/bin/bash
set -e

# Parse command line arguments
OPEN_EDITOR=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --editor)
      OPEN_EDITOR=true
      shift
      ;;
    *)
      break
      ;;
  esac
done

# Find the next issue number by reliably finding the max ID
LAST_ID=0
for f in issues/[0-9]*-*.md; do
  # Check if any files match to avoid errors on the first run
  [ -e "$f" ] || continue

  # Extract number from filename: "issues/123-foo.md" -> "123"
  CURRENT_ID=$(basename "$f" | cut -d'-' -f1)

  if [[ -n "$CURRENT_ID" && "$CURRENT_ID" -gt "$LAST_ID" ]]; then
    LAST_ID=$CURRENT_ID
  fi
done
NEXT_ID=$((LAST_ID + 1))

# Get the issue title from the first argument
if [ -z "$1" ]; then
  echo "Usage: $0 [--editor] \"<issue-title>\""
  echo "  --editor: Open the created issue file in \$EDITOR"
  exit 1
fi
TITLE_SLUG=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -s '[:punct:][:space:]' '-' | sed 's/[^a-z0-9-]*//g' | sed 's/--*//g')
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

This document outlines the step-by-step plan to complete \`${ISSUE_FILE}\`.

## Implementation Plan

- [ ]
EOL

# Add to todo.md
echo "- [ ] **[Issue #${NEXT_ID}]** $1 - \`${ISSUE_FILE}\`" >> todo.md

echo "Created:"
echo "  - ${ISSUE_FILE}"
echo "  - ${PLAN_FILE}"
echo "Updated todo.md"

# Open issue file in editor (only if --editor flag is used)
if [ "$OPEN_EDITOR" = true ] && [ -n "$EDITOR" ]; then
  $EDITOR "$ISSUE_FILE"
fi
