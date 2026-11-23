# Commandes · L'Atelier des Rêves

Appli de prise de commande pour la pâtisserie (V1, avant le site internet).
Utilisée par Ophélie, sur ordinateur, tablette ou téléphone.
En ligne : https://coolinecode.github.io/atelier-commandes/

## Ce que fait la V1

| Écran | Rôle |
|---|---|
| **Journée** | Les commandes à retirer, rangées par créneau, avec un bouton pour passer au statut suivant. Totaux du jour, capacité, liste « À produire ». |
| **Nouvelle commande** | 4 étapes : client (retrouvé par nom ou téléphone), retrait (date + créneau, avec remplissage visible), gâteaux (catalogue + gâteau sur mesure), détails (message, allergies, notes, déjà payée). Alertes : jour fermé, capacité dépassée, créneau complet, délai minimum. |
| **Détail d'une commande** | Statut (Reçue → En préparation → Prête → Retirée), encaissement du solde, modification, « Recommander », impression du bon, annulation. |
| **Commandes** | Recherche (nom, téléphone, n°, gâteau), filtres par période et statut, export CSV pour Excel. |
| **Planning** | Vue de la semaine (charge par jour) et tableau de production gâteau × jour. |
| **Catalogue** | Gâteaux : prix particulier TTC, prix pro HT, TVA, délai minimum, saison, allergènes, masquer/afficher. **Import Excel ou CSV** avec aperçu. |
| **Réglages** | Horaires de retrait, durée des créneaux, capacités, fermetures exceptionnelles, temps forts (Noël, galette…), mot de passe, sauvegarde. |

Pas d'acompte en V1 : tout se paie au retrait (ou est noté « Déjà payée »).

## Fichiers

```
index.html            structure de la page
style.css             apparence (blanc dominant, rose #F7A19E, logo rond)
script.js             toute la logique de l'appli
config.js             mode démo / Supabase (URL du projet + clé publishable)
manifest.webmanifest  installation sur l'écran d'accueil
assets/               logo
vendor/               bibliothèques tierces, versions figées (voir vendor/LICENSES.md)
supabase/schema.sql   base de données + sécurité (droits, RLS), pour une base neuve
supabase/migrations/  modifications appliquées à la base existante, datées
build_demo.py         fabrique une démo en un seul fichier (mode démo)
version.json          numéro de la version publiée (détection des mises à jour)
```

## Importer le catalogue (Excel ou CSV)

*Catalogue > Importer (Excel)*, puis choisir un fichier `.xlsx` ou `.csv`.

- Reconnaît les onglets **Gâteaux BtoC** et **Gâteaux BtoB** de la fiche de cadrage exportée en Excel, ou tout tableau avec une colonne « Nom du gâteau » et une colonne de prix (« Prix TTC » et/ou « Prix HT pro »).
- Colonnes lues si présentes : format, prix TTC, prix HT pro, taux TVA, catégorie, saison, délai minimum, allergènes, description, statut.
- Ignore : les lignes « Exemple : … », les lignes au statut « Non concerné », les colonnes calculées « (auto) », les autres onglets.
- Un gâteau déjà au catalogue (même nom + même format) est **mis à jour**, jamais créé en double. Une ligne BtoB qui porte le même nom et le même format qu'une ligne BtoC ajoute le prix pro au même gâteau.
- Aperçu avant enregistrement : nouveau / mise à jour (avec ancienne → nouvelle valeur) / déjà à jour / erreur. On peut décocher des lignes.
- Relancer le même fichier ne change rien : tout passe en « déjà à jour ».
- *Télécharger le modèle* fournit un fichier Excel vierge au bon format.
- Les fichiers `.xls` (ancien format) ne sont pas lus : les enregistrer en `.xlsx`.

## Bibliothèques (versions figées)

Les bibliothèques sont copiées dans `vendor/` au lieu d'être chargées depuis un CDN : une mise à jour imprévue ne peut pas casser l'appli, et aucun tiers ne sert de code à la page.

| Fichier | Rôle | Chargé |
|---|---|---|
| `vendor/supabase-js-2.119.2.js` | Connexion à Supabase | au démarrage (mode Supabase) |
| `vendor/exceljs-4.4.0.min.js` | Lecture/écriture Excel | seulement à l'ouverture de l'import |

Pour mettre à jour une bibliothèque : remplacer le fichier, changer son nom dans `script.js` (constante `LIBS`), tester en local, puis publier.
SheetJS (`xlsx`) n'est volontairement pas utilisé : la version publiée sur npm (0.18.5) a des failles connues non corrigées.

## Installation (déjà faite, pour mémoire)

1. Supabase (projet en Europe) : exécuter `supabase/schema.sql` dans *SQL Editor*.
2. Autoriser les adresses : `insert into public.app_admins (email) values ('adresse@exemple.fr');`
3. *Authentication > Users > Add user* : même adresse, mot de passe, *Auto Confirm User*.
4. *Authentication* : inscriptions désactivées, connexions anonymes désactivées.
5. *Authentication > URL Configuration* : Site URL et Redirect URLs (`…/atelier-commandes/**`).
6. *Project Settings > API Keys* : URL du projet et clé **publishable** (`sb_publishable_…`) dans `config.js`, `MODE: 'supabase'`. Jamais de clé `sb_secret_` ou `service_role`.
7. GitHub Pages : *Settings > Pages*, branche `main`, dossier `/ (root)`.

Connexion : email + mot de passe (lien par email en secours, limité à 2 emails/heure sans SMTP personnalisé).

## Publier une modification

1. **Changer le numéro de version** (format `AAAA-MM-JJ.n`, ex. `2026-11-22.1` → `2026-11-23.1`) :
   VS Code, `Ctrl+Shift+H` (rechercher et remplacer dans tous les fichiers), ancien numéro → nouveau, **Remplacer tout**.
   Il apparaît à 5 endroits : `version.json`, `script.js` (`APP_VERSION`) et 3 fois dans `index.html` (`?v=`).
2. Tester en local (VS Code, *Go Live*, puis `Ctrl+F5`).
3. *Source Control* : message, **Commit**, **Sync Changes**. GitHub Pages republie en 1 à 2 minutes (puis jusqu'à ~10 minutes de cache).
4. Sur la tablette, l'appli détecte la nouvelle version (au plus tard 10 minutes après, ou au réveil de la tablette) et affiche **« Nouvelle version disponible : Mettre à jour »**. Si une commande est en cours de saisie, elle demande confirmation avant de recharger.

La version en cours est affichée dans *Réglages > Données*.

## Modifications de la base (migrations)

Toute modification de la base de production passe par un fichier daté dans `supabase/migrations/`, appliqué une seule fois, et `schema.sql` est mis à jour pour rester identique.

| Date | Fichier | Objet |
|---|---|---|
| 23/11/2026 | `20261123_durcissement_securite.sql` | Suite au contrôle de sécurité Supabase : `is_admin()` déplacée dans un schéma `private` non exposé à l'API, aucun droit pour les visiteurs non connectés, `search_path` fixé sur les fonctions. Aucune donnée modifiée. |

Après chaque migration : relancer le contrôle de sécurité (*Supabase > Advisors > Security Advisor*).

## Points de vigilance

- **TVA** : les taux réels sont à faire valider par le comptable.
- **Pas de facture** en V1 : le « bon » imprimé n'est pas une facture.
- **Sauvegardes** : le plan gratuit de Supabase n'en fait pas ; *Réglages > Télécharger une sauvegarde* chaque semaine, rangée dans un dossier privé (données clients).
- **Mise en pause** : un projet gratuit est mis en pause après une semaine sans activité (ex. congés) ; le relancer depuis le tableau de bord Supabase.
- **RGPD** : données clients (nom, téléphone, email) à mentionner dans la politique de confidentialité.

## Pour la suite (V2)

Le futur site lira la même base : catalogue, créneaux et capacité sont déjà là.
À ajouter : acompte en ligne, emails de confirmation et de rappel (SMTP personnalisé), factures, fidélité, espace pro.
