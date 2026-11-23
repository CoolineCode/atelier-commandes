# Commandes · L'Atelier des Rêves

Appli de prise de commande pour la pâtisserie (V1, avant le site internet).
Utilisée par Ophélie, sur ordinateur, tablette ou téléphone.
En ligne : https://coolinecode.github.io/atelier-commandes/

## Ce que fait la V1

| Écran | Rôle |
|---|---|
| **Journée** | Les commandes à retirer, rangées par créneau, avec un bouton pour passer au statut suivant. Totaux du jour, capacité, liste « À produire ». |
| **Nouvelle commande** | 5 étapes : client (retrouvé par nom ou téléphone, **email obligatoire**), retrait (date + créneau, avec remplissage visible), gâteaux (catalogue + gâteau sur mesure), détails (message, allergies, notes), **acompte** (montant, moyen de paiement), déjà payée, envoi de la confirmation par email. Alertes : jour fermé, capacité dépassée, créneau complet, délai minimum. |
| **Détail d'une commande** | Statut (Reçue → En préparation → Prête → Retirée), **reste à payer** (total moins acompte), encaissement du solde, envoi et aperçu des emails, modification, « Recommander », impression du bon, annulation (avec rappel de l'acompte versé). |
| **Commandes** | Recherche (nom, téléphone, n°, gâteau), filtres par période et statut, export CSV pour Excel. |
| **Planning** | Vue de la semaine (charge par jour) et tableau de production gâteau × jour. |
| **Catalogue** | Gâteaux : prix particulier TTC, prix pro HT, TVA, délai minimum, saison, allergènes, masquer/afficher. **Import Excel ou CSV** avec aperçu. |
| **Réglages** | Horaires de retrait, durée des créneaux, capacités, fermetures exceptionnelles, temps forts (Noël, galette…), boutique (adresse reprise dans les emails), acompte par défaut, textes des emails, rappel automatique, mot de passe, sauvegarde. |

Acompte : noté à la main dans la commande (pas de paiement en ligne). Le reste à payer (total TTC moins acompte) est affiché partout : fiche, journée, encaissement, export, emails.
Retrait : uniquement à la boutique.

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
supabase/functions/   envoi des emails (send-order-email, send-reminders) + modèle d'email partagé avec l'appli
supabase/cron/        planification du rappel automatique (à lancer une fois, quand tout est prêt)
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

| 23/11/2026 | `20261123_2_acompte_lieu_emails.sql` | Acompte (montant, moyen, date), lieu de retrait (toujours « boutique » aujourd'hui), dates d'envoi de la confirmation et du rappel, journal `email_log`. `save_order` garde les valeurs existantes si l'ancienne version de l'appli ne les envoie pas. Seulement des ajouts. **À lancer avant de publier la version 2026-11-23.1.** |

Après chaque migration : relancer le contrôle de sécurité (*Supabase > Advisors > Security Advisor*).

## Emails aux clients

Le modèle (`supabase/functions/_shared/email-template.js`) sert à la fois à l'aperçu dans l'appli et aux emails réellement envoyés : un seul endroit à modifier.

**Tant que l'envoi automatique n'est pas configuré**, le bouton « Envoyer la confirmation » ouvre l'email prérempli dans la messagerie de l'appareil, puis « C'est envoyé » le note sur la commande.

**Envoi automatique** (gratuit jusqu'à 300 emails par jour avec Brevo) :

1. Nom de domaine acheté au nom de la boutique, domaine authentifié dans Brevo (DKIM et DMARC, obligatoires pour Gmail et Yahoo).
2. Clé API Brevo collée par la propriétaire du compte dans *Supabase > Edge Functions > Secrets*, nom `BREVO_API_KEY`. Jamais dans le code ni dans un message.
3. Adresse d'envoi : *Réglages > Acompte et emails* dans l'appli (ou secret `EMAIL_FROM`).
4. Fonctions déployées : `send-order-email` (appelée par l'appli, vérifie que la personne connectée est autorisée, n'écrit qu'à l'email enregistré sur la commande) et `send-reminders` (rappel, protégée par le secret `CRON_SECRET`). Les deux ont « Verify JWT » désactivé car elles font leur propre contrôle.
5. Rappel automatique : créer `CRON_SECRET`, lancer `supabase/cron/rappels_j2.sql`, vérifier un aperçu, puis cocher *Réglages > Envoyer les rappels automatiquement*. Il part une fois par commande, 2 jours avant le retrait, à partir de 11 h 30 (heure de Paris), pas pour une commande passée le jour même du rappel ni pour une commande annulée.

Chaque envoi (réussi ou en erreur) est noté dans la table `email_log`.

## Points de vigilance

- **TVA** : les taux réels sont à faire valider par le comptable.
- **Pas de facture** en V1 : le « bon » imprimé n'est pas une facture.
- **Sauvegardes** : le plan gratuit de Supabase n'en fait pas ; *Réglages > Télécharger une sauvegarde* chaque semaine, rangée dans un dossier privé (données clients).
- **Mise en pause** : un projet gratuit est mis en pause après une semaine sans activité (ex. congés) ; le relancer depuis le tableau de bord Supabase.
- **RGPD** : données clients (nom, téléphone, email) à mentionner dans la politique de confidentialité.

## Pour la suite (V2)

Le futur site lira la même base : catalogue, créneaux et capacité sont déjà là.
À ajouter : acompte payé en ligne (SumUp), SMS, factures, fidélité, espace pro.
