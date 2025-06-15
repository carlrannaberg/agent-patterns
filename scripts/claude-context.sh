#!/bin/bash
set -e

# Find the first unchecked task in todo.md
CURRENT_TASK_LINE=$(grep -m 1 '\[ \]' todo.md)

if [ -z "$CURRENT_TASK_LINE" ]; then
  echo "No open tasks found in todo.md. You're all done, boss!"
  exit 0
fi

# Extract the issue file path from the task line
ISSUE_FILE=$(echo "$CURRENT_TASK_LINE" | grep -o '`issues/.*\.md`' | tr -d '\`')

if [ ! -f "$ISSUE_FILE" ]; then
    echo "Error: Issue file not found: ${ISSUE_FILE}"
    exit 1
fi

# Derive the plan file path from the issue file path
ISSUE_ID_SLUG=$(basename "$ISSUE_FILE" .md)
PLAN_FILE="docs/plan_${ISSUE_ID_SLUG}.md"

if [ ! -f "$PLAN_FILE" ]; then
    echo "Error: Plan file not found: ${PLAN_FILE}"
    exit 1
fi

echo "#################################################################"
echo "#                 CLAUDE CODE CONTEXT LOADER                    #"
echo "#################################################################"
echo ""
echo "Loading context for the agent..."
echo "  - TODO List:       todo.md"
echo "  - Current Issue:   ${ISSUE_FILE}"
echo "  - Detailed Plan:   ${PLAN_FILE}"
echo ""
echo "You can now prompt the agent, e.g., 'Begin work on the current task.'"
echo ""
echo "# --- This is where you would invoke the Claude Code SDK --- #"
echo "# Example: claude-code --context todo.md --context ${ISSUE_FILE} --context ${PLAN_FILE} --dangerously-skip-permissions"
echo ""
