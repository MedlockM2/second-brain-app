# Google et Apple sur mobile — Cognito

Depuis task-526, les deux connexions utilisent Cognito et `expo-auth-session` avec
PKCE, sur iOS et Android. Les boutons Google et Apple restent sur les écrans de
connexion et d’inscription. Aucun mot de passe n’est créé pour un compte social.

La configuration publique vient de `/api/auth/oauth/config`. Le retour exact est
`media-summarizer://auth-callback`, déclaré par le scheme Expo existant. Les
fournisseurs renvoient d’abord vers `/oauth2/idpresponse` du domaine Cognito.

Les anciens hooks Google, le module Android Credential Manager, les clients
natifs déclarés dans EAS et le SDK Apple ont été supprimés. La suppression de ces
modules change le fingerprint natif : reconstruire les binaires avant de publier
une OTA correspondante. Ne pas supprimer la clé Apple du coffre : Cognito en a
besoin comme paramètre Terraform sensible.

La configuration Google/Apple, les sessions, la récupération et la validation
propriétaire après déploiement sont décrites dans
[AUTHENTICATION_SETUP.md](../../docs/AUTHENTICATION_SETUP.md).
