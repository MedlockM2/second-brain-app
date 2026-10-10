# TASK-438 — app source gelée après un partage

Diagnostic et correctif du 2026-10-10. Le propriétaire a demandé d’appliquer
`iosHideView: false`, puis de committer et pousser. Aucun build natif local ni
reproduction sur appareil par l’agent ; le push peut déclencher la CI habituelle.

**Retour propriétaire du 2026-10-10 :** comparaison effectuée sur son appareil,
le partage via « Plus… » fait planter l'app source, tandis que la sélection par
l'autre chemin fonctionne. Ce résultat confirme le facteur de reproduction
rapporté upstream. L'app source, sa version, le contenu et le build exact de ce
contrôle ne sont pas précisés ; le contournement n'a pas encore été essayé.

## Conclusion

**Forte piste iOS : course de présentation dans `expo-share-intent 6.1.1`.**
L'[issue upstream #217](https://github.com/achorein/expo-share-intent/issues/217)
décrit le même symptôme avec Expo 55 et cette version : le partage aboutit, puis
l'app source ne répond plus. Son auteur soupçonne une terminaison trop précoce de
l'extension, avant la fin de sa présentation UIKit. C'est une hypothèse upstream
cohérente avec notre code généré, pas une cause mesurée sur notre appareil.

Le contournement appliqué est `iosHideView: false` dans les options
du plugin, dans `app.config.ts`. L'[issue #216](https://github.com/achorein/expo-share-intent/issues/216)
rapporte qu'il supprime le gel sur Expo 56 / package 7.0.0, avec une brève
apparition de la modale de l'extension. Son efficacité sur notre build reste à
confirmer. Les deux issues étaient ouvertes lors de la consultation.

**Décision propriétaire : appliquer l’option native `iosHideView: false`.**
Le correctif utilise le chemin du plugin qui attend `viewDidAppear`, sans patch
de dépendance. Son efficacité sur le build distribué reste à confirmer en
rejouant le parcours via « Plus… », avec le flash de modale possible accepté
comme compromis. Le commentaire de configuration renvoie à ce diagnostic.

## Preuve dans notre configuration et le natif généré

- Version installée et verrouillée : `expo-share-intent 6.1.1`, Expo SDK 55.
- Avant le correctif, `app.config.ts:425–429` déclarait le plugin sans
  `iosHideView`. Il déclare désormais explicitement `iosHideView: false`.
- `node_modules/expo-share-intent/plugin/build/ios/writeIosShareExtensionFiles.js:179`
  donne à cette option la valeur par défaut `true`.
- Un prebuild iOS exécuté dans une copie temporaire isolée, sans `.env`, génère
  `ios/MediaSummarizerShare/ShareViewController.swift` :
  - ligne 16 : `let hideView: Bool = true` ;
  - lignes 30–35 : `viewDidLoad` appelle `handleViewLoad()` ;
  - lignes 39–42 : le chemin `viewDidAppear` ne traite que `!hideView`.
- Un second prebuild de cette copie avec `iosHideView: false` réussit. La seule
  différence du contrôleur Swift est `true` → `false` ligne 16 : le traitement
  passe alors par `viewDidAppear`, ligne 42. Le dépôt n'a pas été modifié pour
  cette comparaison initiale. Le prebuild du worktree du correctif confirme
  également `hideView = false` et le démarrage dans `viewDidAppear`.

L'[introduction de cette branche en v6.1.0](https://github.com/achorein/expo-share-intent/commit/5179788b367ee10985c5aebacc4d1f3a5c9afe22)
déplace précisément le démarrage du traitement vers `viewDidLoad` lorsque la vue
est masquée. Cela explique pourquoi désactiver cette option est une expérience
ciblée, sans revenir sur les correctifs de réception de task-188 ou d'auth de
task-278.

## Comment la requête iOS se termine aujourd'hui

Dans le contrôleur généré cité ci-dessus :

1. `handleViewLoad`, lignes 46–79, sélectionne les handlers des pièces jointes.
2. Le handler stocke le contenu dans l'App Group, puis appelle
   `redirectToHostApp` : par exemple lignes 139–145 pour une URL.
3. `redirectToHostApp`, lignes 492–510, ouvre notre schéma d'URL via
   `application.open(url)` ligne 500, puis appelle
   `extensionContext!.completeRequest(...)` ligne 510.

**L'appel à `completeRequest` existe bien sur le chemin nominal.** Rien ne
permet d'affirmer qu'il est absent dans le scénario observé. La piste principale
est son exécution trop tôt dans le cycle UIKit, même quand le partage réussit.
Changer simplement l'ordre `open` / `completeRequest` n'est pas un correctif
démontré par cette lecture.

Autres sorties qui peuvent empêcher ou retarder la terminaison : une pièce
jointe qui ne termine jamais son chargement ; un `try! await loadItem` qui
échoue, notamment lignes 111 ou 136 ; un tableau de pièces jointes vide qui ne
déclenche aucun handler ; un schéma refusé qui quitte `redirectToHostApp` ligne
505. Le chemin d'erreur `dismissWithError`, lignes 476–488, ne termine la requête
qu'après un appui sur « OK », ligne 484. Ces défauts sont secondaires pour un
partage qui a effectivement ouvert notre app et enregistré le contenu.

Le `resetShareIntent()` de `src/contexts/ShareIntentContext.tsx` efface le payload
du module récepteur. Sur iOS, `ExpoShareIntentModule.swift:37–43` ne fait que
vider UserDefaults : ce reset n'est pas la terminaison de l'extension.

## Android : mécanisme différent, cause non établie

Android reçoit un intent `SEND`, sans extension UIKit ni `completeRequest`.
Le plugin applique `android:launchMode = singleTask` par défaut
(`plugin/build/android/withAndroidMainActivityAttributes.js`). Le module natif
`android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt:115–122`
relance l'activité dans une nouvelle tâche si elle n'est pas racine ; les URL
sont ensuite livrées par `EXTRA_TEXT`, les fichiers par `EXTRA_STREAM`.

La lecture ne prouve aucun gel de l'app source Android. La piste iOS ne doit pas
lui être transposée. Le retour propriétaire confirme le chemin « Plus… » de la
feuille de partage incriminée ; aucun résultat Android n'est rapporté.

## Sentry : consultation et limites

Consultation en lecture seule via les credentials récupérés par la méthode de
`scripts/sentry_issue.py`, sans enregistrer ces valeurs. La recherche sans filtre
de statut sur les 14 derniers jours retourne une seule issue, un exemple
d'exception FastAPI daté du 2026-09-29, sans page suivante.

Le projet configuré se déclare `python-fastapi`. La liste des projets accessible
avec ce token ne montre que ce projet ; aucun projet mobile n'est visible.
**Aucun événement exploitable pour TASK-438 dans ce périmètre**, ce qui ne prouve
pas qu'aucun événement existe ailleurs. Il faut vérifier que les credentials de
consultation et le DSN du binaire ciblent effectivement le projet React Native.

Même correctement branché, Sentry dans notre app ne couvre pas les blocages de
l'app source ni automatiquement notre extension, qui est un processus séparé.
Les breadcrumbs `share.received` / `save.created` décrivent seulement la
réception et la sauvegarde chez nous.

## Reproduction à effectuer sur appareil

Les combinaisons détaillées ci-dessous n'ont pas été exécutées par l'agent ; le
propriétaire a depuis confirmé la différence « Plus… » / autre sélection. Pour
chaque essai, noter OS/version, build installé, app source/version, contenu,
notre app froide ou déjà lancée, session valide ou expirée, chemin de sélection
dans la feuille de partage, retour par geste système ou sélecteur d'apps, résultat.

1. Sur iPhone avec un build EAS distribué : partager une URL depuis Safari,
   puis revenir dans Safari et vérifier taps et défilement.
2. Refaire depuis Notes ou une messagerie avec du texte, puis Photos avec une
   image et Fichiers avec un PDF.
3. Pour chaque cas, sélectionner notre app une fois depuis la rangée de
   suggestions, puis depuis « Plus… » et la liste complète. Un
   [commentaire de #217](https://github.com/achorein/expo-share-intent/issues/217#issuecomment-5312557963)
   rapporte une différence systématique entre ces chemins sur son appareil ;
   le propriétaire a confirmé la même différence avant le correctif, sans
   préciser toutes les métadonnées de son essai.
4. Répéter app froide / chaude et plusieurs partages successifs. Comparer le
   build actuel à un nouveau binaire avec `iosHideView: false`, mêmes gestes.
5. Sur Android, refaire les parcours équivalents via le sélecteur de partage.
   Si Android gèle, recueillir séparément logcat et les traces ANR de l'app
   source ; pour iOS, utiliser Console/Xcode attaché à l'extension et observer
   la chronologie de présentation et terminaison.

## Options et coût

| Option | Travail et coût | Limite |
| --- | --- | --- |
| `iosHideView: false` | Une option de plugin, prebuild, nouveau build iOS et contrôle sur appareil ; aucune nouvelle dépendance | Flash de la modale rapporté upstream ; efficacité locale à confirmer |
| Patch du template : démarrer dans `viewDidAppear` en conservant la transparence | Patch versionné via `patch-package` déjà présent, garde contre un second traitement, entretien aux mises à jour, nouveau build et contrôle sur appareil | Plus de code natif maintenu ; proposition upstream non validée ici |
| Attendre upstream | Suivre #216/#217 | Aucun délai garanti ; le symptôme reste présent |

Une mise à jour majeure du package n'est pas une solution établie : #216
concerne déjà la v7, et le commentaire de #217 cite la v8.0.1. Les releases v7
et v8 ciblent respectivement Expo 56 et 57. Un changement de l'extension requiert
un nouveau binaire iOS ; une mise à jour JavaScript OTA seule ne peut le livrer.

## Vérifications locales

- Prebuild iOS sans installation des pods : exit 0 pour la comparaison
  initiale, puis pour la configuration corrigée du worktree ; le contrôleur
  généré porte `hideView = false` et démarre le traitement dans `viewDidAppear`.
- `EXPO_NO_DOTENV=1 npx expo config --type public` : exit 0.
- `npm run lint` : exit 0, un warning préexistant dans
  `src/services/purchaseService.ts:136`.
- `npx tsc --noEmit` : exit 0.
- Aucun test automatisé ajouté ou exécuté. Correctif de configuration appliqué ;
  confirmation après installation du nouveau binaire iOS encore nécessaire.
