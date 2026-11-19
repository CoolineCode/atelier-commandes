# Commandes · L'Atelier des Rêves

Appli de prise de commande pour la pâtisserie (V1, avant le site internet).
Utilisée par Ophélie seule, sur ordinateur, tablette ou téléphone.

## Ce que fait la V1

| Écran | Rôle |
|---|---|
| **Journée** | Les commandes à retirer, rangées par créneau, avec un bouton pour passer au statut suivant. Totaux du jour, capacité, liste « À produire ». |
| **Nouvelle commande** | 4 étapes : client (retrouvé par nom ou téléphone), retrait (date + créneau, avec remplissage visible), gâteaux (catalogue + gâteau sur mesure), détails (message, allergies, notes, déjà payée). Alertes : jour fermé, capacité dépassée, créneau complet, délai minimum. |
| **Détail d'une commande** | Statut (Reçue → En préparation → Prête → Retirée), encaissement du solde, modification, « Recommander », impression du bon, annulation. |
| **Commandes** | Recherche (nom, téléphone, n°, gâteau), filtres par période et statut, export CSV pour Excel. |
| **Planning** | Vue de la semaine (charge par jour) et tableau de production gâteau × jour. |
| **Catalogue** | Gâteaux : prix particulier TTC, prix pro HT, TVA, délai minimum, saison, allergènes, masquer/afficher. |
| **Réglages** | Horaires de retrait, durée des créneaux, capacités, fermetures exceptionnelles, temps forts (Noël, galette…), sauvegarde. |

Pas d'acompte en V1 : tout se paie au retrait (ou est noté « Déjà payée »).

## Fichiers

```
index.html            structure de la page
style.css             apparence (blanc dominant, rose #F7A19E, logo rond)
script.js             toute la logique de l'appli
config.js             mode démo / Supabase (à remplir)
manifest.webmanifest  installation sur l'écran d'accueil
assets/               logo
supabase/schema.sql   base de données + sécurité (à exécuter une fois)
```

## 1. Tester tout de suite (mode démo)

Ouvre `index.html` avec l'extension **Live Server** de VS Code (clic droit > *Open with Live Server*).
Les données d'exemple sont stockées dans le navigateur : rien n'est partagé, rien n'est envoyé.

## 2. Passer en vraies données (Supabase, gratuit au départ)

1. Crée un compte sur supabase.com, puis un projet (région **Europe**, ex. Paris ou Francfort).
2. **SQL Editor > New query** : colle tout `supabase/schema.sql`, clique **Run**.
3. Toujours dans SQL Editor, autorise l'adresse d'Ophélie :
   ```sql
   insert into public.app_admins (email) values ('adresse-d-ophelie@exemple.fr');
   ```
4. **Authentication > Users > Add user > Create new user** : même adresse, coche *Auto confirm user*.
5. **Authentication > Sign In / Providers** : désactive **Allow new users to sign up** (personne d'autre ne pourra créer de compte).
6. **Authentication > URL Configuration** : mets l'adresse où l'appli sera publiée dans *Site URL* et *Redirect URLs* (ex. `https://ton-compte.github.io/atelier-commandes/`).
7. **Project Settings > API** : copie *Project URL* et la clé *anon public* dans `config.js`, et passe `MODE` à `'supabase'`.

La clé *anon* est faite pour être publique : la sécurité repose sur les règles RLS du schéma (seules les adresses de `app_admins` voient les données). Ne mets **jamais** la clé `service_role` dans le code.

Connexion : Ophélie saisit son email, reçoit un lien, clique : c'est tout (pas de mot de passe).

## 3. Mettre en ligne (GitHub Pages)

1. Crée un dépôt `atelier-commandes`, pousse les fichiers.
2. **Settings > Pages** : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
3. Sur la tablette ou le téléphone : ouvre l'adresse, puis « Ajouter à l'écran d'accueil ».

## Points de vigilance

- **TVA** : les prix et le taux de 5,5 % du catalogue de démo sont des exemples. Les taux réels sont à faire valider par son comptable avant usage.
- **Pas de facture** en V1 : le « bon » imprimé n'est pas une facture.
- **Sauvegardes** : Supabase gratuit ne fait pas de sauvegarde téléchargeable ; utiliser régulièrement *Réglages > Télécharger une sauvegarde* (fichier JSON).
- Les projets Supabase gratuits sont mis en pause après une période d'inactivité : à vérifier sur leur grille tarifaire avant de compter dessus en production.
- Données personnelles des clients (nom, téléphone, email) : à mentionner dans sa politique de confidentialité (RGPD).

## Pour la suite (V2)

Le futur site lira la même base : catalogue, créneaux et capacité sont déjà là.
À ajouter : acompte en ligne, emails de confirmation et de rappel, factures, fidélité, espace pro.
