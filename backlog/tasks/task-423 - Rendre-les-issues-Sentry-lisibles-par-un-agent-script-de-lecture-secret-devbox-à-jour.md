---
id: TASK-423
title: >-
  Rendre les issues Sentry lisibles par un agent (script de lecture + secret
  devbox à jour)
status: To Do
assignee: []
created_date: '2026-09-29 20:24'
labels:
  - tooling
  - observability
dependencies: []
references:
  - docs/DEVBOX_SETUP.md
  - mobile/MOBILE_CI_CD.md
  - mobile/src/lib/crashReporting.ts
  - scripts/tail_lambda_logs.py
  - infrastructure/observability/runbooks/pipeline-alerts.md
priority: medium
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Le problème

Sentry est le **seul** signal d'observabilité qu'un agent ne peut pas lire. Côté AWS tout est accessible (CloudWatch Insights, DynamoDB, SQS) avec `AWS_PROFILE=second-brain-app`. Côté Sentry, jusqu'au 2026-09-29, le token ne vivait que dans un secret GitHub (jamais relu) et dans une variable EAS de visibilité `Secret` (« can only be accessed on EAS builder and can't be read in any UI ») — donc introuvable en local.

C'est précisément le signal qui décrit le mieux les **freezes**, que rien d'autre ne capture : `crashReporting.ts:179-180` active `enableAppHangTracking: true, appHangTimeoutInterval: 2` (iOS) et l'ANR natif (Android). Aucun log backend ne voit un gel qui ne throw jamais.

## Ce qui est déjà fait (ne pas le refaire)

Le secret **`media-summarizer-devbox`** porte désormais 19 clés, dont trois ajoutées le 2026-09-29 : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` (`second-brain-labs`), `SENTRY_PROJECT` (`second-brain-app`). `EXPO_PUBLIC_SENTRY_DSN` a été ajouté aux **deux** secrets de secours (`media-summarizer-devbox` et `media-summarizer-devbox-mobile-env`, 8 clés) : il manquait aux deux depuis task-413, si bien qu'un poste remonté depuis eux produisait un `mobile/.env` sans DSN, donc une app silencieuse. L'accès en lecture est vérifié : `GET /api/0/projects/second-brain-labs/second-brain-app/issues/` répond `HTTP 200`.

Rien à écrire dans un fichier tracké : le repo est public (`AGENTS.md`). Le token se lit **uniquement** depuis Secrets Manager, à l'exécution.

## Ce qu'il faut faire

1. **`scripts/sentry_issue.py`**, calqué sur `scripts/tail_lambda_logs.py` (même style d'argparse, même façon de résoudre la région). Il prend un id ou un short-id d'issue, ou un filtre de recherche, et sort pour chaque issue son **dernier événement** avec :
   - les tags qui attribuent le crash à un bundle exact : `release`, `dist`, `ota.update_id`, `ota.embedded_launch`, `api.host`, `environment` (voir `resolveTags()` dans `crashReporting.ts:112-121` et `MOBILE_CI_CD.md` § Crash Reporting) ;
   - les **breadcrumbs**, en mettant en avant les catégories pipeline (`share.*`, `save.*`, `processing.*`, `translation.*`) ;
   - et surtout, extrait explicitement le **`mediaItemId` du breadcrumb `save.created`** (`ShareIntentContext.tsx:891`). C'est la **seule** clé de jointure vers le backend : `Sentry.setUser` n'est jamais appelé, délibérément (`docs/compliance/apple-app-privacy.md` fait reposer la déclaration « Crash Data — Not linked to identity » sur ce fait), donc une issue ne porte ni `user_id` ni compte. Comme `media_item_id == job_id` dans le modèle actuel, c'est cet identifiant qu'on réinjecte dans `filter job_id = "…"` sur CloudWatch Insights.
2. **Le token se lit depuis `media-summarizer-devbox`**, jamais depuis un argument de ligne de commande ni un fichier intermédiaire — même contrainte que le restore du §7 de `DEVBOX_SETUP.md`. Prévoir une surcharge par variable d'environnement pour la CI, mais le défaut est le secret.
3. **Mettre à jour `docs/DEVBOX_SETUP.md` §7**, qui est devenu faux sur trois points : il annonce « quinze clés » (19 désormais), il décrit `media-summarizer-devbox` comme portant « les sept `EXPO_PUBLIC_*` » (huit avec le DSN), et il ne mentionne ni les trois clés Sentry ni le secret `media-summarizer-devbox-mobile-env`, absent du document. Documenter au passage que les scopes du token sont à vérifier avant de s'en servir.
4. **Documenter le chemin d'investigation** dans `infrastructure/observability/runbooks/pipeline-alerts.md` : une section courte « Depuis une issue Sentry » qui enchaîne issue → `mediaItemId` → requête Insights sur `job_id`, et qui dit ce que Sentry ne peut pas donner (pas d'identité, query strings retirées par `scrubBreadcrumb`).

## Hors périmètre

Pas de serveur MCP Sentry : les deux circuits d'investigation (`testflight_triage.sh` via timer systemd, `dispatch_backlog.sh` en worktree) tournent sans humain, et un MCP adossé à un OAuth navigateur n'y fonctionne pas. Le token lu depuis Secrets Manager, si.

## Notes pour l'owner (non vérifiables par l'agent)

- **Le token stocké porte 16 scopes, dont `org:admin`, `project:admin`, `team:admin` et `event:admin`** — il peut supprimer le projet et modifier l'organisation. Décision prise en connaissance de cause le 2026-09-29 pour ne pas bloquer, mais il a aussi transité en clair dans une session d'agent. **À renouveler, en le remplaçant par un token `project:read` + `event:read`.** Le script n'a besoin de rien d'autre ; une fois la rotation faite, plus aucun agent ne détient de droit d'écriture sur Sentry.
- Le token appartient au compte Sentry `marc.medlockfr@gmail.com`, distinct du compte EAS.
- Vérifier après coup, sur un vrai freeze remonté par un testeur, que le script sort bien un `mediaItemId` exploitable — la valeur de tout l'enchaînement en dépend, et aucun freeze de test ne le prouvera.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `scripts/sentry_issue.py` existe, lit `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` et `SENTRY_PROJECT` depuis le secret `media-summarizer-devbox` par défaut, et accepte une surcharge par variables d'environnement. Une lecture du code montre que le token ne passe jamais par un argument de ligne de commande ni par un fichier intermédiaire.
- [ ] #2 Lancé contre le vrai projet Sentry `second-brain-labs/second-brain-app`, le script sort au moins une issue réelle avec ses tags et ses breadcrumbs. La sortie de ce run est collée dans les notes d'implémentation, token masqué.
- [ ] #3 Pour un événement portant un breadcrumb `save.created`, le script affiche le `mediaItemId` extrait, accompagné de la requête CloudWatch Insights prête à copier (`filter job_id = "…"`). Vérifiable dans le code même si aucune issue courante n'en porte.
- [ ] #4 Les tags `release`, `dist`, `ota.update_id`, `ota.embedded_launch`, `api.host` et `environment` sont tous repris dans la sortie quand ils sont présents sur l'événement.
- [ ] #5 Aucune valeur de credential n'apparaît dans un fichier tracké : `git grep -i sntryu_` et une recherche du DSN ne renvoient rien.
- [ ] #6 `docs/DEVBOX_SETUP.md` §7 annonce le bon nombre de clés du secret `media-summarizer-devbox`, mentionne les trois clés Sentry et `EXPO_PUBLIC_SENTRY_DSN`, et décrit le secret `media-summarizer-devbox-mobile-env` qui n'y figurait pas.
- [ ] #7 `infrastructure/observability/runbooks/pipeline-alerts.md` contient une section qui décrit l'enchaînement issue Sentry → `mediaItemId` → requête Insights sur `job_id`, et qui dit explicitement que Sentry ne porte aucune identité (`Sentry.setUser` jamais appelé) et que les query strings sont retirées des breadcrumbs HTTP.
- [ ] #8 `.venv/bin/ruff check scripts/sentry_issue.py` et `.venv/bin/mypy scripts/sentry_issue.py` passent sans erreur.
<!-- AC:END -->
