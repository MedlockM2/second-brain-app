#!/usr/bin/env bash
# Renders one capture per page of the owner's direction (cdp_shot.mjs, exact viewports).
# Usage (from the repository root):
#   bash docs/research/task-424-website-and-browser-extension/mockup-build/shoot_owner.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
DIR="$ROOT/mobile-design-mockups/web_app_owner_direction"
JOBS="$(mktemp)"; echo "[" > "$JOBS"; first=1
shot() { # file width height hash
  local mobile=false; [ "$2" -lt 900 ] && mobile=true
  [ $first -eq 1 ] && first=0 || echo "," >> "$JOBS"
  printf '{"url":"file://%s/code.html#shot=1&%s","out":"%s/screens/%s","width":%s,"height":%s,"scale":%s,"mobile":%s}' \
    "$DIR" "$4" "$DIR" "$1" "$2" "$3" "$([ "$mobile" = true ] && echo 2 || echo 1)" "$mobile" >> "$JOBS"
}
shot 01-accueil.png 1440 900 "s=home"
shot 02-bibliotheque.png 1440 900 "s=library"
shot 03-recherche.png 1440 900 "s=search&sq=pause"
shot 04-digest.png 1440 900 "s=digest"
shot 05-digest-periode.png 1440 900 "s=digestp&dp=weekly&dpos=4"
shot 06-non-classes.png 1440 900 "s=unsorted&pos=3"
shot 07-non-classes-termine.png 1440 900 "s=unsorted&done=1"
shot 08-media.png 1440 900 "s=media&m=m1&cs=streaming"
shot 09-media-artefact.png 1440 900 "s=media&m=m1&art=flashcards"
shot 10-media-volets-reduits.png 1440 900 "s=media&m=m1&lp=0&rp=0"
shot 11-media-en-traitement.png 1440 900 "s=media&m=m10"
shot 12-dossier.png 1440 900 "s=folder&f=f@MEM@&conv=new"
shot 13-dossier-quiz.png 1440 900 "s=folder&f=f@MEM@&art=quiz&cs=failed"
shot 14-dossier-ajouter.png 1440 900 "s=folder&f=f@MEM@&modal=add&into=f@MEM@"
shot 15-compte.png 1440 900 "s=account"
shot 16-compte-langue.png 1440 900 "s=account&sec=reading"
shot 17-compte-formules.png 1440 900 "s=account&sec=plans&beta=0"
shot 18-ranger.png 1440 900 "s=media&m=m11&modal=move&target=m11"
shot 19-connexion.png 1440 900 "s=login"
shot 20-media-sombre.png 1440 900 "s=media&m=m1&cs=streaming&theme=dark"
shot 21-tel-accueil.png 390 844 "s=home"
shot 22-tel-ajouter.png 390 844 "s=home&modal=add"
shot 23-tel-recherche.png 390 844 "s=library"
shot 24-tel-resultats.png 390 844 "s=search&sq=pause"
shot 25-tel-dossier.png 390 844 "s=folder&f=f@MEM@&tab=sources"
shot 26-tel-dossier-ia.png 390 844 "s=folder&f=f@MEM@&tab=ai"
shot 27-tel-media.png 390 844 "s=media&m=m1&tab=reader"
shot 28-tel-media-ia.png 390 844 "s=media&m=m1&tab=ai"
shot 29-tel-discussion.png 390 844 "s=media&m=m1&tab=reader&chat=open&cs=streaming"
shot 30-tel-artefact.png 390 844 "s=media&m=m1&art=quiz"
shot 31-tel-digest.png 390 844 "s=digest"
shot 32-tel-digest-periode.png 390 844 "s=digestp&dp=daily&dpos=2&tab=reader"
shot 33-tel-non-classes.png 390 844 "s=unsorted&pos=3"
shot 34-tel-ranger.png 390 844 "s=unsorted&pos=3&modal=move&target=u6"
shot 35-tel-compte.png 390 844 "s=account"
shot 36-tel-langue.png 390 844 "s=account&sec=reading"
shot 37-tel-sombre.png 390 844 "s=media&m=m1&tab=reader&theme=dark"
echo "]" >> "$JOBS"
MEM="$(node -e "$(cat "$HERE/data.js")
console.log(corpus('ref').memory.id.slice(1))")"
sed -i '' "s/@MEM@/$MEM/g" "$JOBS"
node --experimental-websocket --no-warnings "$HERE/cdp_shot.mjs" "$JOBS"
rm -f "$JOBS"
