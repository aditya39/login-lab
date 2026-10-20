#!/bin/bash
# Claude Code mengirim detail tool call lewat stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
# file yang tidak boleh diedit Claude
if [[ "$FILE_PATH" == *"package-lock.json"* ]]; then
  echo "Blocked: $FILE_PATH" >&2
  exit 2   # 2 = blokir
fi
exit 0     # 0 = boleh lanjut
