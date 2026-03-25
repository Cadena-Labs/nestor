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

nestor_gitconfig_rel="../nestor.gitconfig"
if [ ! -f "${ROOT}/nestor.gitconfig" ]; then
	echo "install-git-hooks: missing ${ROOT}/nestor.gitconfig" >&2
	exit 1
fi
if ! "${GIT_COMMON[@]}" config --local --get-all include.path 2>/dev/null | grep -qF "${nestor_gitconfig_rel}"; then
	"${GIT_COMMON[@]}" config --local include.path "${nestor_gitconfig_rel}"
	echo "install-git-hooks: added local include.path ${nestor_gitconfig_rel}"
fi

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
