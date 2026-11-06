---
name: drain-backlog
description: Traite en séquence, dans la session courante et sur la branche courante, toutes les tâches dispatchables du backlog dont les dépendances sont Done — une par une (résolution, commit, passage à Done) jusqu'à ce qu'il n'en reste plus. À utiliser quand l'owner demande de « vider », « dérouler » ou « traiter » le backlog sans passer par scripts/dispatch_backlog.sh.
---

# Vider le backlog, une tâche à la fois

Alternative séquentielle à `scripts/dispatch_backlog.sh` : pas de worktree, pas d'agent
parallèle, pas de merge. Chaque tâche est résolue directement sur la branche courante puis
committée avant de passer à la suivante, si bien qu'une tâche débloquée par la précédente
entre dans la même boucle.

## 0. Avant la boucle

1. `git status --short` : note les fichiers déjà modifiés ou non suivis. Ils appartiennent à
   l'owner. **Ne les stage jamais** et ne les inclus dans aucun commit. Si une tâche doit
   modifier l'un de ces fichiers, saute-la (raison : « fichier en cours d'édition par
   l'owner : <chemin> ») plutôt que de mélanger son travail au tien.
2. Applique la **Phase 0** de `.claude/agents/backlog-dispatcher.md` (synchronisation des
   `owner_decision` des benchmarks). Elle peut passer des benchmarks à Done et débloquer
   des tâches. Committe ses effets à part : `chore(backlog): sync benchmark owner decisions`.
3. Ne pousse jamais. Le push sur `main` déclenche les déploiements : c'est l'owner qui le fait.

## 1. Sélectionner la prochaine tâche

Les critères sont ceux de la **Phase 1** de `.claude/agents/backlog-dispatcher.md` ; ce
fichier fait foi, ne les recopie pas ici de mémoire. En résumé :

- statut `To Do` ;
- pas de `dispatchable: false` **dans le front-matter** (lignes entre les deux `---` de tête,
  jamais le corps — `awk` sur le fichier, les vues MCP n'exposent pas ce champ) ;
- toutes les `dependencies` au statut `Done` (vérifie-les avec `mcp__backlog__task_view`) ;
- pas de benchmark `owner_decision: pending` sans `complement-request-*` en attente ;
- tri : priorité (high > medium > low), puis numéro croissant.

Exclus aussi les tâches déjà tentées et laissées en `To Do` pendant ce run (voir § 3), pour
ne pas boucler dessus.

**Recalcule la sélection après chaque tâche** : ne fige pas la liste au départ.

S'il n'y a plus de candidate, passe au § 4.

## 2. Résoudre la tâche

1. Annonce en une ligne : `▶ task-XX — <titre>`.
2. Choisis la définition d'agent avec la table de la **Phase 2** du dispatcher (benchmark/
   pricing/product/scoping → `task-research`, cleanup → `task-cleanup`, mobile →
   `task-mobile`, tooling/orchestration/agents → `task-tooling`, ingestion →
   `task-ingestion`, sinon `task-feature`). Lis `.claude/agents/<agent>.md` et suis sa
   séquence et ses contraintes **toi-même**, dans cette session. Ce qui y concerne le
   worktree isolé ne s'applique pas ; tout le reste s'applique (pas de tests automatisés,
   pas de compatibilité ascendante, AC inatteignable laissé non coché avec sa raison,
   aucun secret, ligne `Web:` pour un changement mobile, etc.).
3. Passe la tâche `In Progress` (`mcp__backlog__task_edit`) au démarrage.
4. Vérifie ce qui est à ta portée : `ruff`/`mypy`, `tsc`, `terraform validate`, contrôle
   direct sur les ressources `-dev` (`AWS_PROFILE=second-brain-app`). Jamais `prod`.
5. Mets à jour la tâche : AC cochés pour ce qui est prouvé, `Implementation Notes`
   (ce qui a été fait, ce qui reste hors de portée et pourquoi), puis statut `Done`.
   - **Exception benchmark** : une tâche `task-research` produit son README avec
     `owner_decision: pending` et **reste `To Do`** (le lifecycle de `CLAUDE.md` le veut).
     Elle sort ensuite d'elle-même de la sélection.

## 3. Committer, ou laisser en To Do

**Si la tâche est résolue** :

1. `git add` des seuls fichiers que tu as touchés pour cette tâche, **y compris le fichier
   de tâche** dans `backlog/tasks/` (statut Done, AC, notes). Jamais `git add -A` ni `.`.
2. Filet anti-secret avant de committer :
   `git diff --cached -U0 | grep -inE 'AKIA|ASIA|ghp_|xox[baprs]-|sk-[a-zA-Z0-9]{20}|BEGIN .*PRIVATE KEY|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'`
   — purge toute valeur trouvée avant de continuer.
3. Un commit par tâche, en anglais, au format des commits récents :
   `<type>(<scope>): <résumé> (TASK-XX)`, un corps qui explique le changement, la ligne
   `Web: …` si `mobile/` est touché, puis la ligne `Co-Authored-By` de la session.

**Si la tâche ne peut pas aboutir** (AC atteignable en échec, décision ou accès de l'owner
nécessaire, fichier de l'owner en cours d'édition, ambiguïté réelle sur le périmètre) :

- annule tes modifications de code pour cette tâche (`git restore` sur **tes** fichiers
  seulement) ;
- remets-la `To Do` avec, dans les `Implementation Notes`, ce qui bloque et ce qu'il faut
  à l'owner pour lever le blocage ; committe ce seul fichier de tâche
  (`chore(backlog): note blocker on TASK-XX`) ;
- note-la comme tentée pour ce run et passe à la suivante. Ne t'arrête pas pour demander :
  la question va dans la synthèse finale.

Puis retourne au § 1.

## 4. Synthèse finale

Quand plus aucune tâche n'est sélectionnable, affiche :

```
=== Backlog drained ===
Done: N | Bloquées: N | Benchmarks produits: N

+ task-XX → Done — <commit sha court> — résumé en une ligne
? task-YY → benchmark produit, décision owner attendue — docs/research/…/README.md
X task-ZZ → To Do — ce qui bloque, ce qu'il faut de l'owner
```

Ajoute ensuite, s'il y en a :

- les AC laissés non cochés parce qu'ils exigent un déploiement ou un run Maestro, à
  vérifier par l'owner après son push ;
- les tâches encore `To Do` qui restent hors sélection, avec leur raison (dépendance non
  Done, `dispatchable: false`, benchmark en attente) — une ligne chacune.

Rappelle que rien n'a été poussé.
