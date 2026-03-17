#!/bin/sh
# delcache.sh
# Remove files/folders from git index (stop tracking) for one or more paths.
# Usage examples:
#   sh ./.script/delcache.sh global, token
#   sh ./.script/delcache.sh "global, token"
#   sh ./.script/delcache.sh global token other/dir

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
RESET="\033[0m"

info() { printf "%b%s%b\n" "$BLUE" "$1" "$RESET"; }
ok()   { printf "%b%s%b\n" "$GREEN" "$1" "$RESET"; }
warn() { printf "%b%s%b\n" "$YELLOW" "$1" "$RESET"; }
err()  { printf "%b%s%b\n" "$RED" "$1" "$RESET"; }

usage() {
	cat <<-USAGE
Usage: sh ./.script/delcache.sh <folders>

    Don't be lazy bre, remove files/folders from git index (stop tracking).
    It's helpful for removing sensitive files or large files accidentally committed.
    It's also useful for cleaning up files that should not be versioned.
	<folders> can be a comma-separated list or space-separated values.
	Examples:
		sh ./.script/delcache.sh global, token
		sh ./.script/delcache.sh "global, token"
		sh ./.script/delcache.sh global token other/dir

This will run 'git rm -r --cached -- <path>' for each path (keeps local files).
Afterwards, run a commit to record the change, and add to .gitignore if desired.
USAGE
}

# Ensure we're inside a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	err "Not a git repository (no .git found). Run this from the repo root."
	exit 1
fi

if [ "$#" -eq 0 ]; then
	usage
	exit 1
fi

# Join all args and convert commas to spaces, then iterate words
all="$*"
paths=$(printf '%s' "$all" | tr ',' ' ')

TO_PROCESS=""
for raw in $paths; do
	# trim whitespace (uses xargs to trim)
	folder=$(printf '%s' "$raw" | xargs)
	if [ -z "$folder" ]; then
		continue
	fi
	TO_PROCESS="$TO_PROCESS $folder"
done

if [ -z "$TO_PROCESS" ]; then
	err "No valid folders provided."
	usage
	exit 1
fi

info "Preparing to remove the following from git index:"
for f in $TO_PROCESS; do
	printf "  - %s\n" "$f"
done

for f in $TO_PROCESS; do
	if [ ! -e "$f" ]; then
		warn "Path not found, skipping: $f"
		continue
	fi

	info "Removing from index: $f"
	if git rm -r --cached -- "$f"; then
		ok "Stopped tracking: $f"
	else
		err "Failed to remove from index: $f"
	fi
done

ok "Operation finished."
info "Next steps:"
printf "  - Review changes with: %b git status %b\n" "" ""
printf "  - Commit the change: %b git commit -m 'Stop tracking: %s' %b\n" "" "$(echo $TO_PROCESS)" ""
info "If you want these paths ignored in future commits, add them to .gitignore."

exit 0

