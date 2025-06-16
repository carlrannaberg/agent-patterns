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

# Function to format and display JSON stream from Claude
format_claude_output() {
    local temp_file="$1"

    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│                     🤖 CLAUDE AGENT                        │${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    while IFS= read -r line; do
        # Store all lines for success detection (same as original)
        echo "$line" >> "$temp_file"

        # Parse and format the JSON line for better readability
        if echo "$line" | jq -e . > /dev/null 2>&1; then
            TYPE=$(echo "$line" | jq -r '.type // empty')
            SUBTYPE=$(echo "$line" | jq -r '.subtype // empty')

            case "$TYPE" in
                "system")
                    if [ "$SUBTYPE" = "init" ]; then
                        echo -e "${GRAY}🔧 System initialized${NC}"
                        MODEL=$(echo "$line" | jq -r '.model // empty')
                        if [ "$MODEL" != "empty" ] && [ "$MODEL" != "" ]; then
                            echo -e "${GRAY}   Using model: $MODEL${NC}"
                        fi
                        echo ""
                    fi
                    ;;
                "assistant")
                    MESSAGE=$(echo "$line" | jq -r '.message.content // empty')
                    if [ "$MESSAGE" != "empty" ] && [ "$MESSAGE" != "" ]; then
                        # Check if it's a tool use
                        TOOL_USE=$(echo "$MESSAGE" | jq -r '.[0].type // empty' 2>/dev/null)
                        if [ "$TOOL_USE" = "tool_use" ]; then
                            TOOL_NAME=$(echo "$MESSAGE" | jq -r '.[0].name // empty' 2>/dev/null)
                            echo -e "${BLUE}🔧 Using tool: ${WHITE}$TOOL_NAME${NC}"
                        else
                            # Extract text content
                            TEXT_CONTENT=$(echo "$MESSAGE" | jq -r '.[0].text // empty' 2>/dev/null)
                            if [ "$TEXT_CONTENT" != "empty" ] && [ "$TEXT_CONTENT" != "" ]; then
                                echo -e "${WHITE}💭 Agent: ${NC}$TEXT_CONTENT"
                                echo ""
                            fi
                        fi
                    fi
                    ;;
                "user")
                    CONTENT=$(echo "$line" | jq -r '.message.content[0].content // .message.content // empty' 2>/dev/null)
                    if [ "$CONTENT" != "empty" ] && [ "$CONTENT" != "" ]; then
                        # Truncate very long tool results for readability
                        if [ ${#CONTENT} -gt 200 ]; then
                            CONTENT_PREVIEW="${CONTENT:0:200}..."
                            echo -e "${GREEN}✅ Tool result: ${GRAY}$CONTENT_PREVIEW${NC}"
                        else
                            echo -e "${GREEN}✅ Tool result: ${GRAY}$CONTENT${NC}"
                        fi
                        echo ""
                    fi
                    ;;
                "result")
                    IS_ERROR=$(echo "$line" | jq -r '.is_error // empty')
                    if [ "$IS_ERROR" = "false" ]; then
                        echo -e "${GREEN}✅ Task completed successfully!${NC}"
                    else
                        echo -e "${RED}❌ Task failed${NC}"
                    fi
                    echo ""
                    ;;
            esac
        else
            # If it's not JSON, it might be raw text output
            if [ ! -z "$line" ]; then
                echo -e "${GRAY}📝 Raw output: $line${NC}"
            fi
        fi
    done
}

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

    if ! command -v claude &> /dev/null; then
        echo -e "${RED}Error: 'claude' command not found.${NC}"
        exit 1
    fi

    INITIAL_PROMPT="You are an autonomous AI agent. The following text, provided via stdin, contains your task context (TODO list, issue spec, and implementation plan). Your goal is to execute the plan to resolve the issue. Output your actions and reasoning as you work. The task is complete when you have fulfilled all requirements."

    # Tee the output to a file while also printing it, and check the exit status
    OUTPUT_LOG=$(mktemp)
    AGENT_SUCCESS=false

    # The 'set -o pipefail' ensures that the command fails if any part of the pipe fails.
    set -o pipefail
    if ( cat todo.md "${ISSUE_FILE}" "${PLAN_FILE}" | claude -p "$INITIAL_PROMPT" --dangerously-skip-permissions --output-format stream-json --verbose | format_claude_output "$OUTPUT_LOG" ); then
        # Check the last line of the output log for the success signal from the JSON stream
        LAST_LINE=$(tail -n 1 "$OUTPUT_LOG")
        if echo "$LAST_LINE" | grep -q '"type":"result"' && echo "$LAST_LINE" | grep -q '"is_error":false'; then
            AGENT_SUCCESS=true
        fi
    fi
    set +o pipefail # Reset pipefail option
    rm "$OUTPUT_LOG"

    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"

    if $AGENT_SUCCESS; then
        echo -e "${GREEN}✅ Agent task completed successfully (verified via JSON stream).${NC}"

        echo -e "${BLUE}➡️ Marking task as complete in todo.md...${NC}"
        sed -i.bak "s/${CURRENT_TASK_LINE}/[x]${CURRENT_TASK_LINE:3}/" todo.md
        rm todo.md.bak

        echo -e "${BLUE}📦 Committing changes...${NC}"
        COMMIT_MSG="feat: Complete task from ${ISSUE_FILE}"
        git add .
        git commit -m "$COMMIT_MSG"

        return 0 # Task was successful, continue loop
    else
        echo -e "${RED}⚠️ Agent exited with an error or did not signal success. Stopping the autonomous loop.${NC}"
        return 1 # Agent failed, stop loop
    fi
}

# Main loop
while run_next_task; do
    echo -e "${GREEN}🚀 Moving to the next task...${NC}"
    sleep 1
done
