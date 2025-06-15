#!/bin/bash
set -e

# Function to run the agent on the next available task
run_next_task() {
    # Find the first unchecked task in todo.md
    CURRENT_TASK_LINE=$(grep -m 1 '\[ \]' todo.md)

    if [ -z "$CURRENT_TASK_LINE" ]; then
        echo "🎉 All tasks in todo.md are complete. You're all done, boss!"
        return 1 # No tasks left, so we return 1 to stop the loop
    fi

    # Extract the issue file path from the task line
    ISSUE_FILE=$(echo "$CURRENT_TASK_LINE" | grep -o '`issues/.*\.md`' | tr -d '\`')
    PLAN_FILE="docs/plan_$(basename "$ISSUE_FILE" .md).md"

    if [ ! -f "$ISSUE_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
        echo "Error: Context files not found for task: $CURRENT_TASK_LINE"
        exit 1
    fi

    echo "#################################################################"
    echo "#              AUTONOMOUS AGENT - NEW TASK                   #"
    echo "#################################################################"
    echo "Found next task. Launching agent in headless JSON mode for:"
    echo "  - Current Issue:   ${ISSUE_FILE}"
    echo "  - Detailed Plan:   ${PLAN_FILE}"
    echo ""

    if ! command -v claude &> /dev/null; then
        echo "Error: 'claude' command not found."
        exit 1
    fi

    INITIAL_PROMPT="You are an autonomous AI agent. The following text, provided via stdin, contains your task context (TODO list, issue spec, and implementation plan). Your goal is to execute the plan to resolve the issue. Output your actions and reasoning as you work. The task is complete when you have fulfilled all requirements."

    # Tee the output to a file while also printing it, and check the exit status
    OUTPUT_LOG=$(mktemp)
    AGENT_SUCCESS=false

    # The 'set -o pipefail' ensures that the command fails if any part of the pipe fails.
    set -o pipefail
    if ( cat todo.md "${ISSUE_FILE}" "${PLAN_FILE}" | claude -p "$INITIAL_PROMPT" --dangerously-skip-permissions --output-format stream-json --verbose | tee "$OUTPUT_LOG" ); then
        # Check the last line of the output log for the success signal from the JSON stream
        LAST_LINE=$(tail -n 1 "$OUTPUT_LOG")
        if echo "$LAST_LINE" | grep -q '"event":"result"' && echo "$LAST_LINE" | grep -q '"success":true'; then
            AGENT_SUCCESS=true
        fi
    fi
    set +o pipefail # Reset pipefail option
    rm "$OUTPUT_LOG"


    if $AGENT_SUCCESS; then
        echo "✅ Agent task completed successfully (verified via JSON stream)."

        echo "➡️ Marking task as complete in todo.md..."
        sed -i.bak "s/${CURRENT_TASK_LINE}/[x]${CURRENT_TASK_LINE:3}/" todo.md
        rm todo.md.bak

        echo "📦 Committing changes..."
        COMMIT_MSG="feat: Complete task from ${ISSUE_FILE}"
        git add .
        git commit -m "$COMMIT_MSG"

        return 0 # Task was successful, continue loop
    else
        echo "⚠️ Agent exited with an error or did not signal success. Stopping the autonomous loop."
        return 1 # Agent failed, stop loop
    fi
}

# Main loop
while run_next_task; do
    echo "🚀 Moving to the next task..."
    sleep 1
done
