# Onglet IA, façon NotebookLM

Ce dossier reprend la page existante (`ArtifactsPanel`, partagé par `app/media/[id].tsx` et `app/media/folders/[id].tsx`)
en suivant le Studio de NotebookLM. `code.html` est la maquette autonome ; `screen.png` en est le rendu.

## L'onglet

- **« Générer »** : une grille de quatre tuiles teintées sur deux colonnes, une par format (résumé, notes de cours,
  cartes mémo, quiz). Le résumé détaillé disparaît : sa profondeur passe dans l'option « Longueur » du résumé, son
  contexte et ses citations dans les notes de cours. Chaque format a sa
  teinte, que reprend l'icône de ses fiches dans la liste.
- **Les tuiles restent toujours actives.** Toucher une tuile ouvre « Personnaliser ».
  - La note grise « Généré » disparaît, et `generationAvailable` ne grise plus rien.
  - Les mêmes options sur les mêmes sources renvoient la fiche existante (`generation_outcome: reused`), qui
    s'ouvre.
  - Des options différentes créent une nouvelle fiche, car les paramètres entrent déjà dans le calcul de
    `artifact_id`.
- **Une seule liste sous la grille**, sans titre « Généré » :
  - d'abord les générations en cours, puis les fiches, de la plus récente à la plus ancienne ;
  - une ligne affiche l'icône du format, le titre écrit par le modèle, puis « Type · N sources (dossier) · date » ;
  - une génération échouée reste dans la liste et se relance d'un appui.

## L'animation de génération

La ligne en cours affiche « Génération… » et « Cartes mémo · Quelques secondes · vous pouvez quitter l'écran ».
- Un reflet ambré traverse la ligne de droite à gauche toutes les 1,8 s.
- Deux étincelles scintillent sur l'icône du format, en décalage.
- Avec « Réduire les animations » : pas de reflet, et les étincelles restent fixes.
- La ligne ne s'ouvre pas pendant la génération.

## Personnaliser

C'est un écran plein, avec une croix pour fermer, le titre « Personnaliser le quiz » et un seul bouton,
« Générer ». Les valeurs par défaut sont cochées et suffisent.

| Option | Résumé | Notes de cours | Cartes mémo, quiz |
|---|---|---|---|
| Longueur (Courte, Moyenne, Longue) | oui | non | non |
| Nombre (Moins, Standard, Plus) | non | non | oui |
| Niveau de difficulté (Facile, Moyen, Difficile) | non | non | oui |
| Sources (sélecteur, toutes cochées par défaut) | oui | oui | oui |
| Prompt (« Sur quoi … doit-il se concentrer ? ») | oui | oui | oui |
| Langue (langue de lecture par défaut) | oui | oui | oui |

Les sélecteurs de sources et de langue apparaissent toujours, quels que soient le format et la page (média ou
dossier). Sur un média, le sélecteur de sources indique « 1 », et sa feuille montre la seule source du média,
cochée et non décochable.

Deux éléments de NotebookLM ne sont pas repris :
- l'« Utilisation de l'IA », qu'on ne sait pas encore calculer ;
- « Générer plus tard », qui n'a pas d'équivalent ici.
