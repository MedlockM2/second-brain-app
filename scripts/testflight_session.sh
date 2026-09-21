#!/usr/bin/env bash
# Gère la session Pro 24/7 qui reçoit les rapports de triage TestFlight, pousse la
# notification sur le téléphone de l'owner et exécute ses go/no-go.
# Sa procédure est dans .claude/agents/feedback-decisions.md.
#
# Usage:
#   ./scripts/testflight_session.sh start             # démarre si elle ne tourne pas déjà
#   ./scripts/testflight_session.sh deliver <rapport>  # démarre avec le rapport, ou le transmet
#   ./scripts/testflight_session.sh status            # vie réelle, état, URL Remote Control
#   ./scripts/testflight_session.sh restart           # après une mise à jour de Claude Code
#   ./scripts/testflight_session.sh stop
#   ./scripts/testflight_session.sh logs
#
# Deux sujets distincts ci-dessous : ce que la commande de démarrage doit porter
# (notes 1 à 5), puis pourquoi savoir si la session vit est un problème en soi.
#
# La commande brute est plus subtile qu'il n'y paraît : cinq éléments sont
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
#    settings et MCP user-scope dans un répertoire à part.
#
#    Le répertoire est `~/.claude-personal`, **celui de l'alias `claude-perso` du
#    ~/.zshrc de l'owner**, et pas un répertoire propre à ce script. Il l'a été du
#    2026-09-15 au 2026-09-21, sous le nom `~/.claude-pro-perso` : un quatrième
#    profil, doublon exact de `~/.claude-personal` sur le même compte
#    (marc.medlock@outlook.com, même accountUuid), que l'owner ne savait pas exister
#    puisque le script se l'était créé tout seul. Ce doublon a coûté une demi-heure
#    le 2026-09-21 : le gage bypassPermissions (cf. start_session) devait être
#    accepté dans *ce* répertoire-là, l'owner l'a naturellement accepté via son
#    alias, donc dans l'autre, et rien ne se débloquait. Se caler sur l'alias
#    supprime la classe entière de confusion. Un profil par compte, pas par script.
#
#    Corollaire : la seule chose qui relie une commande `claude` à un abonnement est
#    CLAUDE_CONFIG_DIR. `claude` nu n'est pas « le compte Mirakl » par nature, il lit
#    juste ~/.claude qui, sur ce poste, y est authentifié.
#
#    Effet de bord découvert le 2026-09-16, en cassant un run réel : `ListAgents` et
#    `SendMessage` ne voient que les sessions de leur propre CLAUDE_CONFIG_DIR. Un
#    agent tournant sous le profil par défaut (le triage) ne peut donc **jamais**
#    atteindre cette session par ces outils, aucun moyen de contourner — vérifié
#    aussi côté CLI : `claude --resume <id> --bg` sur une session déjà vivante crée
#    toujours une copie, id complet ou pas, jamais une injection en place. D'où
#    `deliver` ci-dessous plutôt qu'un `SendMessage` tenté depuis l'agent de triage.
#
# Savoir si la session vit, ensuite, n'est pas une simple lecture de registre.
# Autopsie du 2026-09-18, où le triage a préparé deux correctifs puis n'a remis son
# rapport à personne : la session était morte depuis la veille, mais `claude agents
# --json` la listait toujours `blocked`. Trois pièges s'y superposaient, tous les
# trois corrigés dans les fonctions ci-dessous, aucun détectable depuis le journal :
#
#   - le schéma d'une ligne n'a **ni `status` ni `pid`** (c'est `state`), donc les
#     lire rendait du vide — ce qui se lisait comme un « état incohérent » ;
#   - `state: blocked` est le repos **normal** de cette session (elle attend
#     l'owner) et survit à la mort du process : la présence au registre, comme
#     l'état lui-même, ne prouvent rien. Seul atteindre le socket de contrôle le
#     fait ;
#   - une ligne périmée est **définitive** — `claude stop` sort 1 sans la retirer —
#     et la garde d'origine de `start`, qui refusait de démarrer dès qu'une ligne
#     portait ce nom, verrouillait donc `start` *et* `restart` pour de bon.
#
# D'où la règle tenue partout ici : brancher sur `live_session`, jamais sur la
# présence d'une ligne, et ne jamais tenter de nettoyer le registre.

set -euo pipefail

SESSION_NAME="TestFlight Feedback"
MODEL="claude-opus-5"
AGENT="feedback-decisions"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRO_CONFIG_DIR="${HOME}/.claude-personal"

# Sentinelles de la remise par SendMessage (cf. deliver_report). Aucune n'est
# préfixe de l'autre : un grep sur la première ne peut pas matcher la seconde.
DELIVER_OK_TOKEN="REMISE_CONFIRMEE"
DELIVER_FAIL_TOKEN="REMISE_ECHOUEE"

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
#
# Le schéma d'une ligne est exactement `cwd, id, kind, name, sessionId, startedAt,
# state` (relevé sur claude-code 2.1.274). Il n'y a **ni `status` ni `pid`** : les
# lire rendait toujours la chaîne vide, ce qui affichait « TestFlight Feedback :
# (session …, pid ) » et faisait conclure à un état incohérent alors que la seule
# incohérence était ici.
#
# Rend les lignes de la session, **la plus récente d'abord**, en « id sessionId
# state ». L'ordre compte : une ligne périmée ne disparaît jamais du registre (voir
# session_is_live), donc dès qu'une nouvelle session démarre, plusieurs lignes
# portent ce nom et prendre la première venue retombe sur la morte.
session_rows() {
  claude_pro agents --json 2>/dev/null \
    | SESSION_NAME="${SESSION_NAME}" python3 -c '
import json, os, sys
name = os.environ["SESSION_NAME"]
try:
    rows = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)
rows = [r for r in rows if isinstance(r, dict) and r.get("name") == name]
rows.sort(key=lambda r: r.get("startedAt") or 0, reverse=True)
for r in rows:
    print(r.get("id") or "", r.get("sessionId") or "", r.get("state") or "?")
'
}

# Être listé par `agents --json` ne prouve **pas** qu'une session vit. Le registre
# est un fichier sur disque, et l'état `blocked` — le repos normal de cette session,
# qui attend l'owner — y survit à la mort du process. Établi le 2026-09-18 en
# autopsiant l'échec de délivrance du triage : ligne `a4dfc812` toujours listée
# `blocked`, aucun process la portant, et /tmp/cc-daemon-$UID/ vide. Pire, la ligne
# est **définitive** : `claude stop` sur elle répond « couldn't confirm … was
# stopped » et sort 1 sans la retirer. Tout ce script doit donc tolérer une ligne
# fantôme à demeure, jamais chercher à la nettoyer.
#
# Conséquence directe de ce qui précède : la seule preuve de vie est d'atteindre le
# socket de contrôle. `logs` est la sonde la moins chère — purement locale, aucun
# appel API, aucun tour de modèle consommé — et sort 1 sur « connect ENOENT
# …/control.sock ». Son chemin de socket porte un identifiant de daemon
# (`10827c61`) sans rapport avec celui de la session, donc on ne peut pas le tester
# soi-même : il faut passer par la commande.
session_is_live() {
  local job="$1"
  [ -n "${job}" ] && claude_pro logs "${job}" >/dev/null 2>&1
}

# Rend « id sessionId state » de la session vivante la plus récente, ou rien du tout.
# C'est le seul prédicat sur lequel start/deliver/stop/status ont le droit de brancher.
live_session() {
  local job sid state
  while read -r job sid state; do
    if session_is_live "${job}"; then
      printf '%s %s %s\n' "${job}" "${sid}" "${state}"
      return 0
    fi
  done < <(session_rows)
  return 1
}

start_session() {
  # Les apostrophes du texte par défaut cassent le parsing si on les met dans
  # ${1:-...} directement (nombre impair de guillemets simples dans le mot par
  # défaut) : affectation à part.
  local prompt="${1:-}"
  if [ -z "${prompt}" ]; then
    prompt="Tu es la session de pilotage des décisions sur les feedbacks beta TestFlight. Reste disponible et n'entreprends rien tant qu'un rapport n'arrive pas. Réponds en une ligne que tu es prête."
  fi
  # Sur la vie réelle, pas sur la présence au registre : la garde d'origine refusait
  # de démarrer dès qu'une ligne portait ce nom. Avec une ligne fantôme que `stop`
  # ne sait pas retirer, `start` et `restart` étaient tous deux verrouillés pour de
  # bon — le dispositif ne pouvait plus jamais relever sa session.
  local live
  if live="$(live_session)"; then
    echo "Déjà en cours : « ${SESSION_NAME} » (état $(printf '%s' "${live}" | cut -d' ' -f3))."
    echo "Pour la remplacer : $0 restart"
    return 0
  fi

  cd "${REPO_ROOT}"
  local launch_out launch_status
  launch_out="$(claude_pro --bg \
    --name "${SESSION_NAME}" \
    --remote-control "${SESSION_NAME}" \
    --agent "${AGENT}" \
    --model "${MODEL}" \
    --dangerously-skip-permissions \
    "${prompt}" 2>&1)" && launch_status=0 || launch_status=$?
  printf '%s\n' "${launch_out}"

  # Traduction d'un refus dont le message d'origine égare dans ce montage précis.
  # Il conseille « Run `claude --dangerously-skip-permissions` once interactively »
  # sans dire que l'acceptation est portée par le **CLAUDE_CONFIG_DIR**. Suivi tel
  # quel, il l'enregistrerait pour le profil par défaut (compte Mirakl) et la
  # session Pro resterait refusée : le triage échouerait le lendemain à l'identique
  # en paraissant réparé. Rencontré le 2026-09-21, apparu avec la mise à jour
  # automatique 2.1.274 → 2.1.275 de la nuit du 17 au 18, laquelle a du même coup
  # tué la session en cours — c'est ce que `restart` était censé rattraper, sauf que
  # le redémarrage butait désormais sur ce gage. Aucun moyen supporté de l'accepter
  # sans TTY (documenté sur code.claude.com/docs/en/permission-modes), et l'état
  # accepté n'est pas spécifié : on ne peut donc que traduire l'échec, pas le
  # prévenir.
  if printf '%s' "${launch_out}" | grep -q "requires accepting the disclaimer"; then
    {
      echo ""
      echo "Le profil Pro n'a jamais accepté le gage bypassPermissions."
      echo "À faire une seule fois, dans un vrai terminal — l'acceptation est liée au"
      echo "répertoire de configuration, pas au dépôt, donc depuis n'importe où :"
      echo ""
      echo "  CLAUDE_CONFIG_DIR=\"${PRO_CONFIG_DIR}\" command claude --dangerously-skip-permissions"
      echo ""
      echo "Accepter le dialogue, puis quitter. Deux façons de croire l'avoir fait"
      echo "sans l'avoir fait, les deux vérifiables dans ${PRO_CONFIG_DIR}/settings.json,"
      echo "qui doit finir par contenir skipDangerousModePermissionPrompt: true :"
      echo "  - omettre CLAUDE_CONFIG_DIR : accepte pour le profil par défaut (Mirakl) ;"
      echo "  - remplacer « claude » par un alias maison du type claude-perso, qui"
      echo "    réassigne CLAUDE_CONFIG_DIR et gagne — d'où le « command » ci-dessus,"
      echo "    qui court-circuite tout alias."
    } >&2
    return 1
  fi
  return "${launch_status}"
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

  # Vie réelle, pas présence au registre. Le 2026-09-18, la ligne fantôme a fait
  # prendre la branche « déjà vivante » à un dispositif dont la session était morte
  # depuis la veille : `ListAgents` ne trouvait alors évidemment rien, et le rapport
  # est resté sur disque. Sonder la vie ramène ce cas au démarrage à froid, qui est
  # justement celui qui sait porter le rapport en prompt initial.
  if ! live_session >/dev/null; then
    start_session "Le triage TestFlight vient de se terminer. Lis ${report_path} et prépare le go/no-go à présenter à l'owner."
    return $?
  fi

  echo "Session « ${SESSION_NAME} » déjà en cours — délivrance par SendMessage."
  cd "${REPO_ROOT}"

  # `claude -p` sort 0 dès que le tour s'est déroulé, que SendMessage ait abouti ou
  # non — le même piège que celui documenté dans testflight_triage.sh. Le 2026-09-18
  # `deliver` a donc rendu 0 sur un rapport jamais remis, et l'échec n'existait que
  # dans la prose du jetable. On exige donc une sentinelle littérale.
  #
  # Et on la lit **sur la dernière ligne seulement**, jamais par un grep sur tout le
  # texte : un agent à qui l'on parle d'une chaîne de contrôle la cite volontiers en
  # expliquant ce qu'il fait. Ce projet s'est déjà fait prendre exactement là — le
  # run du 2026-09-07 (voir le bloc DELIVERY_LINE de testflight_triage.sh) a écrit
  # une phrase *à propos* de la chaîne d'échec et a ainsi déclenché l'échec. Un grep
  # large ferait ici la faute symétrique, et plus grave : la mention de
  # ${DELIVER_OK_TOKEN} dans une phrase disant l'inverse passerait pour un succès.
  # La règle maison est la même qu'en Phase 7 : seule une ligne structurée est un
  # signal. D'où aussi ${DELIVER_FAIL_TOKEN}, qui donne au jetable un négatif
  # explicite à poser en dernière ligne plutôt qu'une paraphrase.
  local out last
  out="$(claude_pro -p \
    "Utilise ListAgents pour vérifier la présence de la session nommée exactement « ${SESSION_NAME} », puis envoie-lui avec SendMessage ce message : « Nouveau rapport de triage TestFlight disponible : ${report_path}. Lis-le et prépare le go/no-go. » Ta toute dernière ligne doit être exactement ${DELIVER_OK_TOKEN} si SendMessage a effectivement abouti, et exactement ${DELIVER_FAIL_TOKEN} dans tous les autres cas. Cette dernière ligne ne contient que ce mot, et rien d'autre." \
    --allowedTools "ListAgents,SendMessage" \
    --dangerously-skip-permissions 2>&1)" || true
  printf '%s\n' "${out}"

  last="$(printf '%s\n' "${out}" | grep -v '^[[:space:]]*$' | tail -1 | tr -d '[:space:]')"
  if [ "${last}" != "${DELIVER_OK_TOKEN}" ]; then
    echo "Erreur: remise non confirmée — dernière ligne « ${last:-<vide>} » au lieu de ${DELIVER_OK_TOKEN}." >&2
    echo "Le rapport reste sur disque: ${report_path}" >&2
    return 1
  fi
}

stop_session() {
  local live
  if ! live="$(live_session)"; then
    echo "Aucune session « ${SESSION_NAME} » vivante — rien à arrêter."
    return 0
  fi
  claude_pro stop "$(printf '%s' "${live}" | cut -d' ' -f1)"
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
    if ! live="$(live_session)"; then
      echo "Aucune session « ${SESSION_NAME} » vivante." >&2
      exit 1
    fi
    # Le rendu TUI est truffé de séquences ANSI ; on les retire pour rendre le
    # journal lisible dans un pipe.
    claude_pro logs "$(printf '%s' "${live}" | cut -d' ' -f1)" 2>&1 \
      | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'
    ;;
  status)
    if live="$(live_session)"; then
      echo "« ${SESSION_NAME} » : vivante, état $(printf '%s' "${live}" | cut -d' ' -f3) (session $(printf '%s' "${live}" | cut -d' ' -f2))"
      echo "URL Remote Control (téléphone) : voir la ligne « /remote-control is active » de $0 logs"
      exit 0
    fi
    # Distinguer les deux cas : « jamais démarrée » et « ligne fantôme au registre »
    # ne se réparent pas pareil, et confondre les deux est exactement ce qui a fait
    # perdre une journée au triage du 2026-09-18.
    if [ -n "$(session_rows)" ]; then
      echo "« ${SESSION_NAME} » : morte, mais toujours listée par « claude agents »."
      echo "C'est une ligne fantôme : le process a disparu (veille ou redémarrage)"
      echo "et « claude stop » ne sait pas la retirer. Elle est inoffensive — ce"
      echo "script sonde la vie réelle et « $0 start » la contourne."
    else
      echo "« ${SESSION_NAME} » : arrêtée."
    fi
    echo "Le triage de 9h00 démarrera la session lui-même au moment de délivrer."
    echo "Démarrer maintenant : $0 start"
    exit 1
    ;;
  *)
    echo "Usage: $0 {start|deliver <rapport>|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
