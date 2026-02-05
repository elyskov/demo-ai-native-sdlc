#!/usr/bin/env bash
set -euo pipefail

# Prints the most frequently changed files in this git repository.
#
# Definition of "change" here: a commit where the file path appears in `git log --name-only`.
# This is a fast, repo-wide heuristic (it does not attempt per-file rename following).
#
# Output format:
#   <file-path><padding><change-count>
#
# Formatting rules:
# - The change-count column starts at ~character 60 (left-aligned).
# - If the file path is longer than 50 characters, it is shortened by replacing
#   the middle portion with "..." (resulting display length: 50).
#
# Usage:
#   ./most-changed-files.sh            # top 15
#   ./most-changed-files.sh 30         # top 30
#   INCLUDE_MERGES=1 ./most-changed-files.sh

TOP_N="${1:-15}"

if ! [[ "$TOP_N" =~ ^[0-9]+$ ]] || [[ "$TOP_N" -le 0 ]]; then
  echo "Usage: $0 [top_n]" >&2
  echo "  top_n must be a positive integer (default: 15)" >&2
  exit 2
fi

if ! git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

cd "$git_root"

# Exclude merges by default so the count reflects actual change commits.
# Set INCLUDE_MERGES=1 to include merge commits.
log_args=(--pretty=format: --name-only --diff-filter=AMCR)
if [[ "${INCLUDE_MERGES:-0}" != "1" ]]; then
  log_args+=(--no-merges)
fi

# shellcheck disable=SC2016
# (we want awk script in single quotes)
git log "${log_args[@]}" \
  | sed '/^$/d' \
  | LC_ALL=C sort \
  | uniq -c \
  | LC_ALL=C sort -rn \
  | head -n "$TOP_N" \
  | awk '
      function shorten_middle(s, maxlen,    n, head_len, tail_len, head, tail) {
        n = length(s);
        if (n <= maxlen) return s;

        # Keep start and end, replace middle with "...".
        # For maxlen=50 => keep 24 + 23 + 3 = 50.
        head_len = 24;
        tail_len = maxlen - head_len - 3;
        head = substr(s, 1, head_len);
        tail = substr(s, n - tail_len + 1, tail_len);
        return head "..." tail;
      }
      {
        count = $1;
        $1 = "";
        sub(/^[[:space:]]+/, "", $0);

        file_display = shorten_middle($0, 50);
        # Pad file column so counts align around position 60.
        printf "%-60s%s\n", file_display, count;
      }
    '
