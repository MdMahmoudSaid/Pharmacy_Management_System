# Pharmacy Management System — Spécification de conception

## 1. Statut et sources

Cette spécification consolide les exigences des fichiers `Docs/README.md` à
`Docs/12_DATA_MODEL_GUIDANCE.md` et les décisions validées avec le propriétaire
du projet le 10 octobre 2026.

Elle constitue la référence de conception avant le plan d’implémentation. En cas
de contradiction avec une supposition technique non validée, les exigences du
dossier `Docs/` et les décisions explicites de cette spécification prévalent.

## 2. Objectif

Construire une application interne de gestion pour une seule pharmacie. Elle
doit permettre au propriétaire et aux employés autorisés de gérer les shifts,
les médicaments, le stock, les ventes et les dépenses, tout en garantissant que
chaque correction reste traçable et que les quantités et totaux restent
cohérents.

L’application doit être une PWA mobile-first, également confortable sur tablette
et ordinateur. Elle doit fonctionner en arabe et en français.

## 3. Périmètre

### Inclus

- Authentification par numéro mauritanien et PIN.
- Comptes administrateur et employé.
- Permissions granulaires par employé, avec portée personnelle ou globale.
- Shifts.
- Catalogue des médicaments.
- Réceptions, corrections et historique de stock.
- Ventes comportant un ou plusieurs articles.
- Corrections et annulations de ventes.
- Dépenses, corrections et annulations.
- Tableau de bord.
- Rapports filtrables.
- Impression des reçus et rapports.
- Audit immuable.
- Paramètres minimaux.
- Interface arabe et française.
- Installation PWA et gestion explicite des interruptions réseau.

### Exclus

- Fournisseurs, dettes fournisseurs et comptabilité complète.
- Ordonnances et assurances.
- Gestion multi-pharmacies.
- Application client, commerce électronique et livraison.
- Vente transactionnelle hors ligne.
- Gestion avancée des dates d’expiration.
- Matériel spécialisé ou intégrations comptables externes.

## 4. Décisions validées

- Stack : Next.js et TypeScript sur Node.js, avec PostgreSQL et Drizzle ORM.
- Architecture : monolithe modulaire Next.js.
- Déploiement cible : VPS, réalisé ultérieurement par une autre personne.
- Livraison : dépôt GitHub prêt à construire et à déployer, sans secret réel.
- Langues : arabe et français; l’arabe est la langue initiale par défaut.
- Direction : RTL en arabe et LTR en français.
- Téléphone : préfixe visuel fixe `+222`, suivi d’exactement huit chiffres.
- Le premier chiffre local doit être `2`, `3` ou `4`.
- PIN : exactement quatre chiffres, masqué par défaut, avec bouton d’affichage.
- Montants : valeurs décimales exactes, positives quand la règle métier
  l’exige, avec au maximum deux décimales.
- Quantités de médicaments : nombres entiers.
- Permissions : configurables pour chaque employé, y compris les actions
  sensibles.
- Portées : permissions distinctes pour ses propres données et pour toutes les
  données.
- Motif : obligatoire pour toute correction, annulation, réouverture ou autre
  modification sensible.
- Administrateur : peut ouvrir son propre shift pour travailler comme opérateur.
- Les corrections administratives ne nécessitent pas de shift.

## 5. Architecture

Le projet est une application Next.js unique. Les pages et composants clients ne
doivent jamais accéder directement à PostgreSQL. Toutes les lectures protégées et
mutations passent par une couche serveur qui applique, dans cet ordre :

1. Validation de la requête.
2. Vérification de la session.
3. Vérification du compte actif.
4. Vérification de la permission et de sa portée.
5. Application des règles métier.
6. Transaction PostgreSQL lorsque plusieurs écritures forment une seule action.
7. Création des mouvements et entrées d’audit nécessaires.
8. Retour d’un résultat traduit et sans détail technique sensible.

### Modules

- `auth` : connexion, déconnexion, sessions et limitation des tentatives.
- `users` : employés, archivage, préférences et permissions.
- `shifts` : ouverture, fermeture, correction et réouverture.
- `medicines` : catalogue, prix courant et archivage.
- `stock` : réceptions, corrections, solde et registre de mouvements.
- `sales` : panier, confirmation, correction, annulation et reçu.
- `expenses` : création, correction et annulation.
- `dashboard` : indicateurs du jour et activité récente.
- `reports` : ventes, dépenses, stock, mouvements, employés et shifts.
- `audit` : consultation de l’historique immuable.
- `settings` : identité de la pharmacie et préférences d’impression.
- `i18n` : arabe, français, RTL et LTR.

Les modules exposent des services métier explicites. Une mutation financière ou
de stock ne doit pas contourner ces services.

## 6. Authentification et sessions

### Identifiant

L’interface montre `+222` dans une zone fixe et non modifiable. L’utilisateur
saisit huit chiffres locaux. Le premier doit être `2`, `3` ou `4`. Le serveur
normalise et stocke le numéro sous la forme `+222XXXXXXXX`, avec unicité garantie
par PostgreSQL.

### PIN

Le PIN contient exactement quatre chiffres. Le bouton œil n’en change que
l’affichage local. Le PIN n’est jamais stocké, transmis dans les journaux ou
renvoyé par une API en clair; seule une empreinte lente et salée est conservée.

Parce qu’un PIN à quatre chiffres possède un espace de recherche limité, le
serveur applique une limitation par compte et par origine, renvoie un message
générique en cas d’échec et journalise les événements de sécurité sans enregistrer
le PIN.

### Sessions

- Jeton de session aléatoire et non prédictible.
- Valeur exploitable stockée uniquement dans un cookie `HttpOnly`.
- Cookie `Secure` en production et politique `SameSite` appropriée.
- Session révocable au logout, à la désactivation du compte et lors d’une
  réinitialisation de PIN.
- Nouvelle vérification des permissions sur chaque opération serveur; les droits
  ne sont pas figés dans l’interface.

Un compte désactivé ne peut ni se connecter ni continuer à utiliser une ancienne
session. La réinitialisation d’un PIN révoque les sessions existantes et exige la
permission correspondante ainsi qu’un motif.

## 7. Autorisation

Le rôle `ADMIN` possède tous les droits. Le rôle `EMPLOYEE` ne possède que les
permissions qui lui sont attribuées.

Le catalogue de permissions couvre au minimum :

- ouverture et fermeture de son shift;
- création de vente;
- consultation de ses ventes ou de toutes les ventes;
- modification du prix lors de la création d’une vente;
- correction et annulation de ses ventes ou de toutes les ventes;
- réception de stock;
- consultation du stock et des mouvements;
- correction de stock;
- création de dépense;
- consultation, correction et annulation de ses dépenses ou de toutes les
  dépenses;
- consultation de ses shifts ou de tous les shifts;
- correction et réouverture de shifts;
- création, modification, archivage et restauration de médicaments;
- consultation et impression de chaque famille de rapports;
- consultation de l’audit;
- création, modification, désactivation et restauration des employés;
- réinitialisation du PIN d’un employé;
- attribution et retrait de permissions;
- gestion des paramètres.

Une permission de gestion globale ne doit pas être déduite d’une permission de
gestion personnelle. L’interface masque les actions indisponibles, mais ce
comportement n’est qu’une aide visuelle : le serveur reste l’autorité.

## 8. Modèle de données conceptuel

### Utilisateurs et sécurité

- `users` : identité, téléphone normalisé, hash du PIN, rôle, langue, état actif,
  métadonnées de création et modification.
- `sessions` : empreinte du jeton, utilisateur, expiration, révocation et dates.
- `permissions` : clé stable, domaine, action et portée.
- `user_permissions` : association entre utilisateur et permission.

Un employé est représenté par `users`; aucune table employé distincte n’est
nécessaire dans cette version.

### Opérations

- `shifts` : utilisateur opérateur, ouverture, fermeture, statut et métadonnées.
- `medicines` : nom, code facultatif, prix courant, stock courant mis en cache,
  état actif et métadonnées.
- `stock_movements` : médicament, quantité avant, variation, quantité après,
  type, enregistrement lié, shift éventuel, auteur, note et date.
- `sales` : numéro public, shift, opérateur, total, statut, clé d’idempotence et
  métadonnées.
- `sale_items` : vente, médicament, quantité, prix unitaire historique et total
  de ligne.
- `expenses` : montant, description, shift, auteur opérationnel, date de
  l’opération, statut et métadonnées.
- `audit_logs` : acteur, entité, identifiant, action, anciennes valeurs, nouvelles
  valeurs, motif, contexte lié et date.
- `settings` : nom de la pharmacie, langue par défaut et préférences minimales
  d’impression.

### Types et contraintes

- Identifiants internes séquentiels de grande capacité.
- Horodatages PostgreSQL avec fuseau horaire.
- Montants `numeric` avec deux décimales; aucun montant financier en virgule
  flottante.
- Quantités entières avec contraintes de positivité adaptées à chaque table.
- Téléphone et numéro public de vente uniques.
- Clés étrangères indexées.
- Index composés alignés avec les filtres de rapports.
- Index partiel garantissant au plus un shift ouvert par utilisateur.
- Contrainte empêchant le stock courant de devenir négatif.
- Suppression physique interdite pour les données historiques référencées.

## 9. Stock et concurrence

Le registre `stock_movements` est l’historique immuable. Le champ de stock courant
de `medicines` est un cache transactionnel destiné aux recherches rapides.

Toute action modifiant le stock doit :

1. Verrouiller les médicaments concernés dans l’ordre de leur identifiant.
2. Vérifier le stock disponible et l’état actif lorsque nécessaire.
3. Calculer la variation.
4. Mettre à jour le stock courant.
5. Ajouter un mouvement contenant les quantités avant et après.
6. Ajouter l’audit requis.
7. Valider toutes les écritures ensemble.

Une erreur à n’importe quelle étape annule l’ensemble. Les transactions doivent
rester courtes et ne contenir aucun appel réseau ou rendu d’impression.

Une correction ne modifie pas un ancien mouvement. Elle crée les mouvements
compensatoires qui rendent le nouveau solde correct et conserve le lien avec
l’opération corrigée.

## 10. Shifts

- Un utilisateur peut avoir au plus un shift ouvert.
- Toute personne, administrateur compris, ouvre un shift avant de créer une
  vente, une dépense opérationnelle ou une réception de stock.
- Une correction administrative ne requiert pas de shift.
- Les ventes, dépenses et réceptions opérationnelles conservent le shift
  d’origine.
- La fermeture exige une confirmation.
- La correction des heures ou la réouverture exige une permission, une
  confirmation et un motif obligatoire.
- Les totaux de shift sont calculés depuis les transactions liées et actives; ils
  ne sont pas saisis manuellement.
- Une correction historique recalcule donc automatiquement le résumé du shift,
  même si celui-ci est fermé.

## 11. Médicaments et réceptions de stock

Un médicament possède au minimum un nom, un code interne facultatif, un prix de
vente courant, un stock courant et un statut.

- La recherche porte sur le nom et le code.
- Une réception exige un shift actif, la permission correspondante et une
  quantité entière positive.
- Si le médicament n’existe pas, sa création exige la permission de gérer le
  catalogue.
- Modifier le prix courant ne modifie aucun prix historique.
- Un médicament utilisé historiquement est archivé, jamais supprimé.
- Un médicament archivé reste visible dans l’historique mais ne peut pas être
  sélectionné pour une nouvelle vente.
- Une restauration exige une permission et laisse une trace d’audit.

## 12. Ventes

### Création

Une vente contient un ou plusieurs articles. L’opérateur doit avoir un shift
actif et la permission de créer une vente.

Au moment de la confirmation, le serveur :

1. Vérifie la session, le shift et les permissions.
2. Vérifie que le panier n’est pas vide.
3. Vérifie chaque médicament, quantité entière positive et prix positif.
4. Vérifie la permission si un prix diffère du prix courant.
5. Déduplique les articles d’un même médicament.
6. Traite la clé d’idempotence.
7. Verrouille les médicaments dans un ordre stable.
8. Revérifie les stocks.
9. Crée la vente et les articles avec leurs prix historiques.
10. Réduit le stock et crée les mouvements.
11. Enregistre l’audit de création.
12. Valide la transaction puis seulement annonce le succès.

Une répétition de la même requête avec la même clé renvoie le résultat existant
et ne modifie pas une seconde fois le stock.

### Correction

La correction peut changer le médicament, la quantité ou le prix. Elle exige la
permission portant sur la vente concernée, une confirmation et un motif.

Le serveur restaure l’effet de l’ancienne version, vérifie que la nouvelle
version peut être appliquée, applique le nouvel effet, recalcule les totaux et
ajoute les mouvements et l’audit dans une seule transaction.

### Annulation

L’annulation exige une permission, une confirmation et un motif. Elle passe la
vente au statut `CANCELLED`, restaure le stock, exclut la vente des totaux actifs
et conserve toutes les données historiques.

### Reçu

Le reçu comporte le nom configuré de la pharmacie, le numéro de vente, la date,
l’opérateur, les articles, quantités, prix unitaires et total. Il est imprimé dans
la langue active et sans navigation de l’application.

## 13. Dépenses

- Une création opérationnelle exige un shift actif et la permission requise.
- Le montant doit être strictement positif et comporter au plus deux décimales.
- La description est obligatoire.
- Une correction exige une permission, une confirmation et un motif; elle met à
  jour tous les totaux dérivés et crée un audit.
- Une annulation change le statut sans supprimer la ligne, exige un motif et
  exclut la dépense des totaux actifs.
- Les filtres couvrent la période, l’utilisateur et le shift.

## 14. Audit et historique

L’audit est append-only pour l’application. Une entrée contient l’acteur,
l’action, l’entité, l’identifiant, l’ancienne valeur, la nouvelle valeur, le motif
et l’horodatage.

Actions minimales : `CREATE`, `UPDATE`, `CORRECT`, `CANCEL`, `ARCHIVE`, `RESTORE`
et `REOPEN`.

Le motif est obligatoire pour toutes les actions sensibles. Cela inclut au
minimum les corrections et annulations, la réouverture d’un shift, la correction
manuelle du stock, le changement du prix courant d’un médicament, l’utilisation
d’un prix différent pendant une vente, l’archivage ou la restauration d’un
médicament ou d’un utilisateur, la réinitialisation d’un PIN et la modification
des permissions. Le motif est visible dans le détail de l’historique. Un
utilisateur ordinaire ne peut ni modifier ni supprimer une entrée d’audit.

## 15. Tableau de bord et rapports

Le tableau de bord affiche au minimum :

- ventes actives du jour;
- dépenses actives du jour;
- résumé du stock;
- nombre de shifts ouverts;
- activité récente;
- synthèse d’activité des employés.

Il ne comporte pas de graphiques décoratifs ni de nouveau système d’alertes de
stock dans cette version.

Les rapports couvrent les ventes, dépenses, stock, mouvements de stock,
employés et shifts. Les filtres de période utilisent des limites cohérentes selon
le fuseau `Africa/Nouakchott`. Les enregistrements annulés restent identifiables
mais sont exclus des totaux actifs. Chaque famille de rapports possède ses
permissions de consultation et d’impression. Les périodes proposées sont
Aujourd’hui, Hier, Cette semaine, Ce mois et une plage personnalisée.

## 16. Interface et internationalisation

### Direction visuelle

- Vert pétrole `#0F5D5E` pour les actions principales.
- Fond froid `#F7FAF9`.
- Texte bleu-noir `#172426`.
- Ambre `#C47A12` pour l’attention.
- Rouge `#B42318` pour les actions destructives.
- Famille Noto Sans avec variante arabe, auto-hébergée.
- Libellés en casse naturelle; aucun texte décoratif au détriment de la clarté.
- Cibles tactiles larges, focus clavier visible et information jamais transmise
  uniquement par la couleur.

### Navigation

Sur mobile, la navigation principale comporte Accueil, Vente, Stock, Shift et
Plus. Le menu Plus affiche les pages restantes selon les permissions. Sur grand
écran, une barre latérale remplace la barre inférieure. L’interface arabe inverse
les alignements, l’ordre spatial et les icônes directionnelles nécessaires.

### Pages

- Connexion.
- Accueil employé et shift actif.
- Tableau de bord administrateur.
- Vente et historique des ventes.
- Médicaments.
- Stock et mouvements.
- Dépenses.
- Shifts.
- Employés et permissions.
- Rapports.
- Audit.
- Paramètres minimaux.

La page de vente privilégie la recherche, le panier et un total toujours visible.
Chaque liste possède un chargement, un état vide utile, des erreurs traduites et
une pagination adaptée. Les actions dangereuses décrivent leur effet avant de
demander confirmation et motif.

## 17. PWA et comportement réseau

- L’application fournit un manifeste et les ressources nécessaires à
  l’installation.
- Le shell de l’interface peut être remis en cache de manière sûre.
- Aucune vente, dépense ou réception n’est créée hors ligne.
- Une coupure conserve autant que possible la saisie locale non confirmée et
  affiche clairement que l’opération n’est pas enregistrée.
- Une nouvelle tentative réutilise la même clé d’idempotence.
- Aucun message de succès ne précède la validation serveur.

## 18. Sécurité et exploitation

- Validation serveur systématique.
- Cookies de session sécurisés.
- Protection des mutations contre les requêtes intersites.
- En-têtes de sécurité adaptés à une application web moderne.
- Limitation des tentatives de connexion et des opérations sensibles abusives.
- Compte PostgreSQL applicatif sans privilège de superutilisateur.
- Connexions PostgreSQL mises en pool et limitées.
- Secrets fournis uniquement par variables d’environnement.
- Journaux structurés sans PIN, jeton ou secret.
- Migrations versionnées et reproductibles.

Le dépôt fournit `.env.example`, les commandes de migration, la commande de
création du premier administrateur et un guide de déploiement VPS. La réalisation
du déploiement n’appartient pas au périmètre de développement demandé.

## 19. Stratégie de tests

### Tests unitaires

- Validation du téléphone, du PIN, des montants et des quantités.
- Calcul des lignes et totaux de vente.
- Calcul des variations de stock.
- Résolution des permissions et des portées.
- Calcul des limites temporelles des rapports.

### Tests d’intégration PostgreSQL

- Contraintes d’unicité et de référence.
- Un seul shift ouvert par utilisateur.
- Création atomique d’une vente.
- Refus du stock négatif.
- Deux ventes simultanées sur le même stock.
- Correction et annulation avec mouvements compensatoires.
- Double soumission avec la même clé d’idempotence.
- Recalcul des totaux après correction.
- Immutabilité applicative de l’audit.

### Tests de bout en bout

- Connexion et désactivation d’un employé.
- Parcours arabe RTL et français LTR.
- Parcours mobile et ordinateur.
- Shift, vente, stock, dépense et corrections.
- Refus d’une action masquée tentée directement contre le serveur.
- Impression sans navigation.
- Coupure réseau sans faux succès.

Les 19 scénarios de `Docs/11_ACCEPTANCE_TESTS.md` sont obligatoires. Le plan
d’implémentation doit relier chacun d’eux à une tâche et à un test automatisé ou,
pour les contrôles visuels d’impression, à une vérification reproductible.

## 20. Critères de réussite

Le produit est prêt lorsque :

- les 19 scénarios d’acceptation passent;
- une erreur opérationnelle normale peut être corrigée sans incohérence;
- stock, shifts, tableau de bord et rapports donnent les mêmes résultats;
- aucune action non autorisée ne réussit en appelant directement le serveur;
- une double soumission ne crée jamais deux transactions;
- les anciennes ventes conservent leurs prix et identités historiques;
- les archives ne cassent aucune donnée passée;
- les interfaces arabe et française sont utilisables sur téléphone et ordinateur;
- les reçus et rapports imprimés contiennent les valeurs correctes;
- le dépôt peut être remis au responsable du VPS sans contenir de secret.

## 21. Séquençage recommandé

L’implémentation doit avancer par tranches testables :

1. Fondations, base PostgreSQL, langues, authentification et permissions.
2. Utilisateurs, médicaments et shifts.
3. Registre de stock et réceptions.
4. Ventes, concurrence, corrections et reçus.
5. Dépenses et corrections.
6. Tableau de bord, rapports, audit et impressions.
7. PWA, durcissement de sécurité, tests d’acceptation et documentation de remise.

Chaque tranche doit conserver l’application exécutable et testable avant de
commencer la suivante.
