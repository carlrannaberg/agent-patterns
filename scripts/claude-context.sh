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
echo "#                 CLAUDE CONTEXT LOADER                    #"
echo "#################################################################"
echo ""
echo "Found task. Launching agent with the following context:"
echo "  - TODO List:       todo.md"
echo "  - Current Issue:   ${ISSUE_FILE}"
echo "  - Detailed Plan:   ${PLAN_FILE}"
echo ""

# Check if claude is installed
if ! command -v claude &> /dev/null
then
    echo "Error: 'claude' command not found."
    echo "Please ensure the Claude Code CLI is installed and in your PATH."
    exit 1
fi

# Concatenate context files and pipe them to the claude command with an initial prompt.
INITIAL_PROMPT="You are an autonomous AI agent. The following text, provided via stdin, contains your task context. It consists of a TODO list, a high-level issue description, and a detailed implementation plan. Your goal is to execute the plan to resolve the issue. Please begin."

(
  echo "--- CONTEXT START (from stdin) ---"
  echo ""
  echo "## FILE: todo.md"
  cat todo.md
  echo ""
  echo "## FILE: ${ISSUE_FILE}"
  cat "${ISSUE_FILE}"
  echo ""
  echo "## FILE: ${PLAN_FILE}"
  cat "${PLAN_FILE}"
  echo ""
  echo "--- CONTEXT END ---"
) | claude "$INITIAL_PROMPT" --dangerously-skip-permissions
