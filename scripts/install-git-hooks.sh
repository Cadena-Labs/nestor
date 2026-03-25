#!/usr/bin/env bash
set -euo pipefail

if [ -n "${CI:-}" ]; then
	echo "install-git-hooks: CI detected; skipping hook install."
	exit 0
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
	echo "install-git-hooks: run from inside a git repository." >&2
	exit 1
}

GIT_COMMON=(git -C "${ROOT}")
GIT_DIR_ABS="$(cd "$("${GIT_COMMON[@]}" rev-parse --git-dir)" && pwd)"

if [ ! -f "${ROOT}/nestor.gitconfig" ]; then
	echo "install-git-hooks: missing ${ROOT}/nestor.gitconfig" >&2
	exit 1
fi
if [ ! -f "${ROOT}/allowed_signers" ]; then
	echo "install-git-hooks: missing ${ROOT}/allowed_signers" >&2
	exit 1
fi

# Copy signing metadata into .git/ so it survives checkouts of commits that predate
# these files (e.g. git rebase --exec). Including ../nestor.gitconfig from .git/config
# alone breaks once that path disappears from the working tree.
ALLOWED_DST="${GIT_DIR_ABS}/allowed_signers"
SIGNING_CFG="${GIT_DIR_ABS}/nestor-signing.config"
cp "${ROOT}/allowed_signers" "${ALLOWED_DST}"
awk -v abs="${ALLOWED_DST}" '
/^[[:space:]]*allowedSignersFile[[:space:]]*=[[:space:]]*allowed_signers[[:space:]]*$/ {
	print "\tallowedSignersFile = " abs
	next
}
{ print }
' "${ROOT}/nestor.gitconfig" > "${SIGNING_CFG}.tmp" && mv "${SIGNING_CFG}.tmp" "${SIGNING_CFG}"

nestor_gitconfig_rel="../nestor.gitconfig"
signing_rel="nestor-signing.config"
while "${GIT_COMMON[@]}" config --local --get-all include.path 2>/dev/null | grep -qxF "${nestor_gitconfig_rel}"; do
	"${GIT_COMMON[@]}" config --local --unset include.path "${nestor_gitconfig_rel}" || break
done
if ! "${GIT_COMMON[@]}" config --local --get-all include.path 2>/dev/null | grep -qxF "${signing_rel}"; then
	"${GIT_COMMON[@]}" config --local include.path "${signing_rel}"
fi
echo "install-git-hooks: wrote ${SIGNING_CFG} and ${ALLOWED_DST}; include.path -> ${signing_rel}"

HOOKS_SRC="${ROOT}/scripts/git-hooks"
HOOKS_DIR="$("${GIT_COMMON[@]}" rev-parse --git-path hooks)"

mkdir -p "${HOOKS_DIR}"

for name in pre-commit pre-push; do
	src="${HOOKS_SRC}/${name}"
	if [ ! -f "${src}" ]; then
		echo "install-git-hooks: missing ${src}" >&2
		exit 1
	fi
	chmod +x "${src}"
	ln -sf "${src}" "${HOOKS_DIR}/${name}"
	echo "install-git-hooks: linked ${name} -> ${src}"
done
