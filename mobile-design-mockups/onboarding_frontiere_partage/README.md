# Intro : frontière de l'exemple de partage

Maquette de réponse au retour TestFlight `ADZeDymcOHjaBxBEw0v01wY` (build 21, 2026-11-01). Source : `_build/build.mjs`. Rendu : `code.html` → `screen.png`.

## Le retour

« Il faut plus marquer visuellement la frontière entre l'écran qui montre l'exemple de partage depuis YouTube, et le reste. »

Page « Enregistrez depuis n'importe quelle app » du carrousel d'après connexion (`mobile/app/onboarding/intro.tsx`, `ShareSheetArt` dans `mobile/src/components/intro/IntroArt.tsx`), capture en thème sombre.

## Cause

La feuille est dessinée en `surface` (#211e19) sur le fond `surfaceContainerLow` (#262320), soit un contraste de 1,06:1. L'ombre `shadows.soft` ne se voit pas sur fond sombre. En clair, #ffffff sur #f7f3f0 donne 1,10:1.

## Directions

- **A · Contour** : même feuille, un ton plus clair (`surfaceContainer`) et cernée d'un filet. Changement minimal, mais rien ne dit encore qu'on est dans une autre app.
- **B · Dans un téléphone (recommandé)** : la feuille du système, dans un iPhone, par-dessus YouTube grisé. Le cadre fait la frontière et montre le contexte. C'est le même téléphone que celui de la page 2 (#1c1b1a). En sombre, un bord titane détache le cadre du fond. La feuille est à 82 % de sa taille, et la rangée de contacts grisée est retirée pour que la rangée des apps reste au-dessus du dégradé du bouton.
- **C · Scène** : l'illustration sur un panneau plus sombre, à bord fin. C'est un cadre de plus, qui ne montre rien du contexte.

## Décision de l'owner (2026-11-01)

B retenue et implémentée dans `ShareSheetArt` (`mobile/src/components/intro/IntroArt.tsx`).
