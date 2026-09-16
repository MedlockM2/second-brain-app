#!/usr/bin/env bash
# Gère la session Pro 24/7 qui reçoit les rapports de triage TestFlight, pousse la
# notification sur le téléphone de l'owner et exécute ses go/no-go.
# Sa procédure est dans .claude/agents/feedback-decisions.md.
#
# Usage:
#   ./scripts/testflight_session.sh start             # démarre si elle ne tourne pas déjà
#   ./scripts/testflight_session.sh deliver <rapport>  # démarre avec le rapport, ou le transmet
#   ./scripts/testflight_session.sh status            # état, et l'URL Remote Control
#   ./scripts/testflight_session.sh restart           # après une mise à jour de Claude Code
#   ./scripts/testflight_session.sh stop
#   ./scripts/testflight_session.sh logs
#
# La commande brute est plus subtile qu'il n'y paraît : quatre éléments sont
# indispensables et chacun a été établi en le cassant d'abord.
#
# 1. `env -u CLAUDE_CODE_USE_BEDROCK -u AWS_BEARER_TOKEN_BEDROCK -u ANTHROPIC_MODEL`
#    Lancée depuis une session `claude-bedrock`, la commande hérite de ces trois
#    variables et la session « Pro » démarre en réalité sur Bedrock — ce qui vide de
#    son sens le partage du travail (le lourd sur Bedrock, le pilotage sur Pro).
#    Inoffensif depuis un terminal ordinaire, où elles ne sont pas définies.
#
# 2. `--model claude-opus-5`, l'identifiant complet et non l'alias `opus`.
#    `claude` et `claude-bedrock` partagent ~/.claude.json, dont un cache
#    (`clientDataCacheSlots`) mémorise le dernier modèle utilisé. En mode Bedrock il
#    y inscrit `us.anthropic.claude-opus-5`, que la session Pro reprend et que
#    l'API Claude.ai refuse — la session démarre, affiche « Claude Pro », puis chaque
#    tour meurt sur « issue with the selected model ». L'identifiant explicite
#    court-circuite le cache.
#
# 3. `--name` ET `--remote-control` séparément, avec le même libellé.
#    `--remote-control [nom]` ne nomme que la session côté téléphone. Le nom
#    d'adressage inter-sessions — celui que `ListAgents` affiche et que
#    `SendMessage` prend — vient de `--name`. Sans lui, il est auto-généré depuis le
#    contenu de la conversation (observé : « feedback triage review ») et change à
#    chaque relance : le triage de 9h00 ne retrouverait pas sa cible.
#
# 4. `--agent feedback-decisions`
#    Le contexte d'une session qui vit des jours finit compacté. La procédure de
#    go/no-go doit donc être une définition d'agent, relue à chaque tour, pas un
#    prompt de démarrage qui s'évapore.
#
# 5. `CLAUDE_CONFIG_DIR`, ajouté le 2026-09-15.
#    Sur ce poste, le profil par défaut (~/.claude) est authentifié sur le compte
#    Mirakl de l'employeur — c'est désormais lui qui porte le travail lourd
#    (scripts/testflight_triage.sh, `claude` nu, plus de claude-bedrock). Sans cette
#    variable, cette session « Pro » démarrerait donc sur le compte Mirakl et non
#    sur l'abonnement personnel. CLAUDE_CONFIG_DIR isole entièrement credentials,
#    settings et MCP user-scope dans un répertoire à part : s'y logguer une fois
#    avec le compte perso (`CLAUDE_CONFIG_DIR="$HOME/.claude-pro-perso" claude auth
#    login`) suffit, c'est permanent.
#
#    Effet de bord découvert le 2026-09-16, en cassant un run réel : `ListAgents` et
#    `SendMessage` ne voient que les sessions de leur propre CLAUDE_CONFIG_DIR. Un
#    agent tournant sous le profil par défaut (le triage) ne peut donc **jamais**
#    atteindre cette session par ces outils, aucun moyen de contourner — vérifié
#    aussi côté CLI : `claude --resume <id> --bg` sur une session déjà vivante crée
#    toujours une copie, id complet ou pas, jamais une injection en place. D'où
#    `deliver` ci-dessous plutôt qu'un `SendMessage` tenté depuis l'agent de triage.

set -euo pipefail

SESSION_NAME="TestFlight Feedback"
MODEL="claude-opus-5"
AGENT="feedback-decisions"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRO_CONFIG_DIR="${HOME}/.claude-pro-perso"

# Le compte Pro perso, jamais Mirakl ni Bedrock : cf. notes 1 et 5 ci-dessus.
claude_pro() {
  env -u CLAUDE_CODE_USE_BEDROCK -u AWS_BEARER_TOKEN_BEDROCK -u ANTHROPIC_MODEL \
    CLAUDE_CONFIG_DIR="${PRO_CONFIG_DIR}" claude "$@"
}

# `claude agents --json` rend deux identifiants distincts et non interchangeables :
# `sessionId` (l'UUID complet, qui identifie la conversation) et `id` (les 8 premiers
# caractères, présent uniquement sur les sessions d'arrière-plan). `logs`, `stop` et
# `attach` n'acceptent que le second — passer l'UUID donne « No job matching ». On
# résout donc toujours `id` pour piloter, et `sessionId` seulement pour l'affichage.
session_field() {
  claude_pro agents --json 2>/dev/null \
    | SESSION_NAME="${SESSION_NAME}" FIELD="$1" python3 -c '
import json, os, sys
name, field = os.environ["SESSION_NAME"], os.environ["FIELD"]
try:
    rows = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)
for row in rows if isinstance(rows, list) else []:
    if row.get("name") == name:
        print(row.get(field, ""))
        break
'
}

start_session() {
  # Les apostrophes du texte par défaut cassent le parsing si on les met dans
  # ${1:-...} directement (nombre impair de guillemets simples dans le mot par
  # défaut) : affectation à part.
  local prompt="${1:-}"
  if [ -z "${prompt}" ]; then
    prompt="Tu es la session de pilotage des décisions sur les feedbacks beta TestFlight. Reste disponible et n'entreprends rien tant qu'un rapport n'arrive pas. Réponds en une ligne que tu es prête."
  fi
  local existing
  existing="$(session_field sessionId)"
  if [ -n "${existing}" ]; then
    echo "Déjà en cours : « ${SESSION_NAME} » ($(session_field status))."
    echo "Pour la remplacer : $0 restart"
    return 0
  fi

  cd "${REPO_ROOT}"
  claude_pro --bg \
    --name "${SESSION_NAME}" \
    --remote-control "${SESSION_NAME}" \
    --agent "${AGENT}" \
    --model "${MODEL}" \
    "${prompt}"
}

# Point d'entrée du triage (feedback-triage.md, Phase 7). Ne jamais laisser ce
# dernier appeler ListAgents/SendMessage lui-même : cf. note 5 plus haut, ça ne
# peut pas fonctionner depuis son profil. Deux cas :
#   - session absente (le cas normal, puisqu'on ne la démarre plus qu'ici) :
#     démarrage à froid avec le rapport comme prompt initial, aucun SendMessage ;
#   - session déjà vivante (run répété le même jour, ou owner en cours de revue) :
#     un jetable tourne *dans* le profil Pro perso via claude_pro, donc il voit sa
#     sœur et peut lui parler par SendMessage -- la frontière de profil n'existe
#     plus puisqu'il n'y en a qu'un des deux côtés cette fois.
deliver_report() {
  local report_path="${1:-}"
  if [ -z "${report_path}" ]; then
    echo "Usage: $0 deliver <chemin-du-rapport>" >&2
    return 1
  fi
  if [ ! -f "${report_path}" ]; then
    echo "Erreur: rapport introuvable: ${report_path}" >&2
    return 1
  fi

  local existing
  existing="$(session_field sessionId)"

  if [ -z "${existing}" ]; then
    start_session "Le triage TestFlight vient de se terminer. Lis ${report_path} et prépare le go/no-go à présenter à l'owner."
    return $?
  fi

  echo "Session « ${SESSION_NAME} » déjà en cours — délivrance par SendMessage."
  cd "${REPO_ROOT}"
  claude_pro -p \
    "Utilise ListAgents pour vérifier la présence de la session nommée exactement « ${SESSION_NAME} », puis envoie-lui avec SendMessage ce message : « Nouveau rapport de triage TestFlight disponible : ${report_path}. Lis-le et prépare le go/no-go. » Réponds en une ligne confirmant l'envoi ou l'échec." \
    --allowedTools "ListAgents,SendMessage" \
    --dangerously-skip-permissions
}

stop_session() {
  local job
  job="$(session_field id)"
  if [ -z "${job}" ]; then
    echo "Aucune session « ${SESSION_NAME} » en cours."
    return 0
  fi
  claude_pro stop "${job}"
}

case "${1:-status}" in
  start)
    start_session
    ;;
  deliver)
    deliver_report "${2:-}"
    ;;
  stop)
    stop_session
    ;;
  restart)
    stop_session
    sleep 2
    start_session
    ;;
  logs)
    job="$(session_field id)"
    if [ -z "${job}" ]; then
      echo "Aucune session « ${SESSION_NAME} » en cours." >&2
      exit 1
    fi
    # Le rendu TUI est truffé de séquences ANSI ; on les retire pour rendre le
    # journal lisible dans un pipe.
    claude_pro logs "${job}" 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'
    ;;
  status)
    sid="$(session_field sessionId)"
    if [ -z "${sid}" ]; then
      echo "« ${SESSION_NAME} » : arrêtée."
      echo "Le triage de 9h00 écrira son rapport sur disque et sortira non-zéro."
      echo "Démarrer : $0 start"
      exit 1
    fi
    echo "« ${SESSION_NAME} » : $(session_field status) (session ${sid}, pid $(session_field pid))"
    echo "URL Remote Control (téléphone) : voir la ligne « /remote-control is active » de $0 logs"
    ;;
  *)
    echo "Usage: $0 {start|deliver <rapport>|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
