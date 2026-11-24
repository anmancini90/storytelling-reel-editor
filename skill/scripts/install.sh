#!/bin/bash
# Installs this skill for Claude Code, links it for Codex when Codex is on this computer, then runs setup.
#   bash "<the unzipped skill folder>/scripts/install.sh"   [--no-setup] [--force]
# It never replaces a newer installed version with an older download (an old unzipped folder left in Downloads);
# --force does.
# Re-running it updates the skill. Your styles, videos and sound kit live in your Reels folder, never in here, so an
# update never touches them. Locations: CLAUDE_CONFIG_DIR (default ~/.claude), CODEX_HOME (default ~/.codex).
set -e
NAME=storytelling-reel-editor
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
[ -f "$SRC/SKILL.md" ] || { echo "install.sh must stay inside the skill folder (no SKILL.md next to scripts/)"; exit 1; }
NO_SETUP=0; FORCE=0
for a in "$@"; do case "$a" in --no-setup) NO_SETUP=1 ;; --force) FORCE=1 ;; esac; done
SKILLS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
DST="$SKILLS/$NAME"
mkdir -p "$SKILLS"
rm -rf "$SKILLS/.$NAME".new.* "$SKILLS/.$NAME".old.*   # left by an install that failed part way

version() { if [ -f "$1/VERSION" ]; then tr -d ' \n' < "$1/VERSION"; else echo 0.0.0; fi; }
newer() {   # is version $1 newer than $2 (numbers, so 1.10 > 1.9)?
  local IFS=.; local a=($1) b=($2) i x y
  for i in 0 1 2; do
    x=$((10#${a[$i]:-0})); y=$((10#${b[$i]:-0}))
    [ "$x" -gt "$y" ] && return 0
    [ "$x" -lt "$y" ] && return 1
  done
  return 1
}
V_NEW="$(version "$SRC")"

if [ -L "$DST" ]; then
  echo "claude: $DST is a link (a developer install): left as it is"
elif [ -d "$DST" ] && [ "$(cd "$DST" && pwd -P)" = "$SRC" ]; then
  echo "INSTALLED claude $DST (v$V_NEW, already installed here)"
else
  V_OLD=""
  if [ -d "$DST" ]; then
    V_OLD="$(version "$DST")"
    if newer "$V_OLD" "$V_NEW" && [ "$FORCE" = 0 ]; then
      echo "NOT INSTALLED: v$V_OLD is already installed and this folder ($SRC) is an older download, v$V_NEW."
      echo "Use the newest download (check its VERSION file), or run this again with --force to go back to v$V_NEW."
      exit 1
    fi
  fi
  # copy into a new folder first, then swap it in, so a failed copy never leaves half a skill
  NEW="$SKILLS/.$NAME.new.$$"; OLD="$SKILLS/.$NAME.old.$$"
  trap 'rm -rf "$NEW"' EXIT
  cp -R "$SRC/." "$NEW/"
  find "$NEW" \( -name __pycache__ -o -name .DS_Store \) -prune -exec rm -rf {} +
  [ -e "$DST" ] && mv "$DST" "$OLD"
  mv "$NEW" "$DST"
  rm -rf "$OLD"
  echo "INSTALLED claude $DST (v$V_NEW${V_OLD:+, was v$V_OLD})"
fi

CX="${CODEX_HOME:-$HOME/.codex}"
if [ -d "$CX" ]; then
  mkdir -p "$CX/skills"
  LINK="$CX/skills/$NAME"
  if [ -L "$LINK" ] || [ ! -e "$LINK" ]; then
    ln -sfn "$DST" "$LINK"
    echo "LINKED codex $LINK -> $DST (one copy for both apps)"
  else
    echo "codex: $LINK is a separate copy: left as it is (delete it and run this again to share one copy)"
  fi
else
  echo "codex: not found ($CX), skipped"
fi

[ "$NO_SETUP" = 1 ] && exit 0
trap - EXIT
exec bash "$DST/scripts/setup.sh"
