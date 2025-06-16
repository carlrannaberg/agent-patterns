#!/bin/bash
set -e

# ANSI color codes for better formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Function to run the agent on the next available task
run_next_task() {
    # Find the first unchecked task in todo.md
    CURRENT_TASK_LINE=$(grep -m 1 '\[ \]' todo.md)

    if [ -z "$CURRENT_TASK_LINE" ]; then
        echo -e "${GREEN}🎉 All tasks in todo.md are complete. You're all done, boss!${NC}"
        return 1 # No tasks left, so we return 1 to stop the loop
    fi

    # Extract the issue file path from the task line
    ISSUE_FILE=$(echo "$CURRENT_TASK_LINE" | grep -o '`issues/.*\.md`' | tr -d '\`')
    PLAN_FILE="docs/plan_$(basename "$ISSUE_FILE" .md).md"

    if [ ! -f "$ISSUE_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
        echo -e "${RED}Error: Context files not found for task: $CURRENT_TASK_LINE${NC}"
        exit 1
    fi

    echo -e "${PURPLE}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${PURPLE}│              🤖 AUTONOMOUS AGENT - NEW TASK                │${NC}"
    echo -e "${PURPLE}└─────────────────────────────────────────────────────────────┘${NC}"
    echo -e "${WHITE}Found next task. Launching agent for:${NC}"
    echo -e "${CYAN}  📋 Issue:  ${YELLOW}${ISSUE_FILE}${NC}"
    echo -e "${CYAN}  📝 Plan:   ${YELLOW}${PLAN_FILE}${NC}"
    echo ""
    echo -e "${CYAN}┌─ Agent Output ──────────────────────────────────────────────┐${NC}"

    if ! command -v claude &> /dev/null; then
        echo -e "${RED}Error: 'claude' command not found.${NC}"
        exit 1
    fi

    INITIAL_PROMPT="You are an autonomous AI agent. The following text, provided via stdin, contains your task context (TODO list, issue spec, and implementation plan). Your goal is to execute the plan to resolve the issue. Output your actions and reasoning as you work. The task is complete when you have fulfilled all requirements."

    # Use regular text output format for cleaner display
    AGENT_SUCCESS=false
    if ( cat todo.md "${ISSUE_FILE}" "${PLAN_FILE}" | claude -p "$INITIAL_PROMPT" --dangerously-skip-permissions --output-format text --verbose ); then
        AGENT_SUCCESS=true
    fi

    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"

    if $AGENT_SUCCESS; then
        echo -e "${GREEN}✅ Agent task completed successfully${NC}"

        echo -e "${BLUE}➡️ Marking task as complete in todo.md...${NC}"
        sed -i.bak "s/${CURRENT_TASK_LINE}/[x]${CURRENT_TASK_LINE:3}/" todo.md
        rm todo.md.bak

        echo -e "${BLUE}📦 Committing changes...${NC}"
        COMMIT_MSG="feat: Complete task from ${ISSUE_FILE}"
        git add .
        git commit -m "$COMMIT_MSG"

        return 0 # Task was successful, continue loop
    else
        echo -e "${RED}⚠️ Agent exited with an error. Stopping the autonomous loop.${NC}"
        return 1 # Agent failed, stop loop
    fi
}

# Main loop
while run_next_task; do
    echo -e "${GREEN}🚀 Moving to the next task...${NC}"
    sleep 1
done
