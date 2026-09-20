#!/bin/zsh
cd -- "${0:A:h}" || exit 1
# Finder does not load the shell profile that normally enables Node through nvm.
for blog_node in "$(command -v node)" /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/*/bin/node(NOn); do
  if [[ -x "$blog_node" ]] && "$blog_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' 2>/dev/null; then
    "$blog_node" blog/scripts/launch.mjs && exit 0
    break
  fi
done
echo 'Write Blog could not open. It requires Node.js 22 or later and the blog dependencies. See blog/README.md.'
read -k 1 '?Press any key to close.'
exit 1
