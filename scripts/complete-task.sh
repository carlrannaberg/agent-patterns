#!/bin/bash

# Script to mark a task as complete in todo.md
# Usage: ./complete-task.sh <issue_number>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <issue_number>"
    echo "Example: $0 4"
    exit 1
fi

ISSUE_NUM=$1
TODO_FILE="todo.md"

# Check if todo.md exists
if [ ! -f "$TODO_FILE" ]; then
    echo "Error: $TODO_FILE not found"
    exit 1
fi

# Use sed to replace [ ] with [x] for the specified issue
# Escape square brackets and use a more specific pattern
sed -i '' "s/- \[ \] \*\*\[Issue #${ISSUE_NUM}\]\*\*/- [x] **[Issue #${ISSUE_NUM}]**/" "$TODO_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Marked Issue #${ISSUE_NUM} as complete"
    echo "Updated todo.md:"
    grep "Issue #${ISSUE_NUM}" "$TODO_FILE"
else
    echo "❌ Failed to update todo.md"
    exit 1
fi