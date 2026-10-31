# AUDIT APPROFONDI : LOGS RUNTIME, ANALYSE DES INTERFACES & CHASSE AUX ZOMBIES

**Projet** : Facturier — Application Desktop Fintech (Architecture Hub & Spoke / Local-First)  
**Date d'audit** : 29 Octobre 2026  
**Auteur** : Antigravity (Auditeur Senior Ingénierie Logicielle & Ergonomie UI/UX)  
**Périmètre** : Logs d'exécution runtime (`Electron: 26272`, `Next.js Dev: 1484`), Analyse des 68 captures d'écran (`sceenshorts/`), Inventaire des anomalies, zombies, parasites et mauvaises pratiques.

---

## 1. RÉSUMÉ EXÉCUTIF & MATRICE DE SANTÉ

| Axe d'Audit | Score / Santé | Diagnostic Synthétique |
| :--- | :---: | :--- |
| **I. Processus & Logs Runtime** | **8.5 / 10** | Architecture IPC solide et confinement efficace, mais présence d'un bug critique de timeout bloquant l'impression native et de pollutions Crashpad Win32. |
| **II. Ergonomie & Visual Psychology** | **8.0 / 10** | Design épuré inspiré des standards fintech modernes, mais parasité par des boutons aux couleurs discordantes (bouton orange criard), des empty states mensongers et des scrollbars envahissantes. |
| **III. Conformité Fiscale & Métier** | **9.5 / 10** | Moteur CEMAC / DGI Gabon rigoureux (TVA 18%, CSS 1%, TPS 9.5%), notes d'avoir OHADA intégrées, gestion des arrondis et multi-tenancy sans faille. |
| **IV. Qualité de Code & Anti-Zombies** | **9.0 / 10** | TypeScript strict à 0 erreur, ADRs synchronisées (45 fiches valides), nettoyage anti-processus orphelins actif, mais présence de fragments de JSON brut injectés dans le DOM. |

---

## 2. ANALYSE CRITIQUE DES LOGS RUNTIME & PROCESSUS SYSTÈME

### 2.1. Bug Critique : Le Timeout Asynchrone de l'Impression Native (`ipc.js`)

#### Symptômes & Détection dans les Logs et Captures
* **Dans les logs terminaux** :
  ```log
  [Print] Fenêtre cachée chargée, lancement de print()
  [Print] Timeout de 15s atteint lors de la génération.
  ```
* **Sur les captures d'écran** :
  * [Capture d'écran 2026-10-29 192711.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20192711.png) : L'utilisateur ouvre la modale d'impression Windows (*Electron - Print*) et sélectionne son imprimante (*OneNote (Desktop)*).
  * [Capture d'écran 2026-10-29 192723.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20192723.png) : Toast rouge d'échec critique : *"Échec de l'impression native. Veuillez vérifier votre imprimante ou relancer l'application."*

#### Cause Racine (Piège Asynchrone & Zombie Timer)
Dans le fichier [apps/desktop/main/ipc.js](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/main/ipc.js#L93-L125) :
1. Un timer de 15 secondes était armé au début de la préparation du document HTML temporaire.
2. Une fois le document chargé (`did-finish-load`), `webContents.print({ silent: false })` ouvrait la boîte de dialogue native du système d'exploitation Windows.
3. **Le timer continuait de tourner en arrière-plan pendant que l'utilisateur humain choisissait son imprimante ou configurait ses paramètres d'impression.**
4. Passé 15 secondes d'inactivité humaine sur la modale Windows, le timer se déclenchait, détruisait violemment la fenêtre cachée (`printWin.destroy()`) et rejetait la promesse IPC avec un Timeout.
5. De plus, si l'utilisateur fermait la boîte de dialogue en cliquant sur "Annuler", l'erreur renvoyée par Chromium était traitée comme un crash au lieu d'une annulation normale.

#### Correctif Appliqué
* Déarmement immédiat du timer (`clearTimeout(timer)`) dès que l'événement `did-finish-load` est émis : le document est prêt, l'utilisateur a tout le temps nécessaire pour dialoguer avec l'OS.
* Gestion différenciée de `errorType === 'cancelled'` pour renvoyer une confirmation neutre `{ success: false, cancelled: true }` évitant les toasts d'erreur anxiogènes.

---

### 2.2. Pollution Crashpad Win32 (`CreateFile: 0x2`)

#### Symptômes dans les Logs
```log
ERROR:third_party\crashpad\crashpad\util\win\registration_protocol_win.cc:108 
CreateFile: The system cannot find the file specified. (0x2)
```

#### Cause Racine
Sous Windows, Chromium/Electron tente par défaut de s'enregistrer auprès d'un pipe nommé Crashpad pour le rapport de crash télémétrique. En environnement de développement hors-ligne ou sans serveur Sentry/Crashpad déployé, cette tentative échoue silencieusement au niveau OS mais génère une ligne d'erreur alarmante dans la console de debug.

#### Correctif Appliqué
Ajout du commutateur Chromium dans [apps/desktop/main.js](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/main.js#L24-L27) en mode développement :
```javascript
if (isDev) {
  app.commandLine.appendSwitch('disable-crash-reporter');
}
```

---

### 2.3. Décalage de Compilation Next.js & FOUC Initial (Écran Blanc)

#### Symptômes & Analyse
* [Capture d'écran 2026-10-29 200419.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20200419.png) : Écran totalement blanc au tout premier affichage lors de la redirection vers l'onboarding `/setup`.
* **Cause** : En mode développement, Next.js compile les routes à la volée (JIT). La fenêtre Electron déclenche son événement `did-finish-load` sur le squelette HTML minimal alors que le bundle JavaScript Webpack/Turbopack est encore en cours d'évaluation.
* **Résilience** : Le mécanisme de repli implémenté dans [apps/desktop/main/window.js](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/main/window.js#L170-L205) avec ses 3 tentatives espacées et sa page d'attente graphique intégrée garantit l'absence de crash fatal en production standalone.

---

## 3. AUDIT VISUEL ET PSYCHOLOGIE COGNITIVE DES 68 CAPTURES D'ÉCRAN

### Flux A : Assistant d'Initialisation & Onboarding (`200419` à `201037`)

1. **Rupture Ergonomique du Défilement (Overflow vertical non guidé)** :
   * Sur [Capture d'écran 2026-10-29 200439.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20200439.png), les champs *"Téléphone entreprise"* et *"Email professionnel"* sont coupés à ras par le bas de la fenêtre. Le bouton principal *"Continuer vers l'accès administrateur"* est complètement invisible hors de l'écran.
   * L'utilisateur est forcé de scroller manuellement sans indication visuelle (pas d'ombre de scroll ni de bouton sticky en bas).
2. **Dissonance Cognitive des Indicateurs de Progression** :
   * L'en-tête indique : *"50% complété"*.
   * La barre latérale indique : *"Dossier Entreprise 56%"*, *"Identité 25%"*, *"Régime Fiscal 100%"*.
   * Cette multiplication d'indicateurs désynchronisés viole la loi de Hick et surcharge inutilement l'attention cognitive de l'utilisateur lors de sa première impression.
3. **Excellence Ergonomique (Points Forts)** :
   * L'aperçu dynamique instantané de la facture en temps réel (affichant automatiquement la TVA 18%, CSS 1% et TPS 9.5%) crée un effet "Aha!" rassurant et professionnel.
   * Le badge administrateur interactif à l'étape 2 ([Capture 201037.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20201037.png)) qui se met à jour lettre par lettre avec calcul de la force du mot de passe.

---

### Flux B : Tableau de Bord & Hiérarchie Visuelle (`192347`, `192403`, `201059`, `201112`)

1. **Le Parasite Visuel : Bouton `AJOUTER UN UTILISATEUR` (`bg-amber-500`)** :
   * Sur [Capture d'écran 2026-10-29 201112.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20201112.png) et [192403.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20192403.png), la barre d'action inférieure affichait un gigantesque bouton orange fluorescent (`bg-amber-500`) de hauteur `h-14` pour "AJOUTER UN UTILISATEUR".
   * **Aberration d'Ergonomie Financière** : L'ajout d'utilisateur est une tâche d'administration rare (mensuelle ou trimestrielle), alors que la facturation est une tâche quotidienne. Donner à l'ajout d'utilisateur le CTA le plus voyant du tableau de bord viole la hiérarchie visuelle et la loi de Fitts.
   * **Correctif** : Remplacement par une barre d'action équilibrée et thématisée avec un bouton primaire *"Nouvelle Facture"*, un bouton neutre *"Gérer les Utilisateurs"* et un bouton secondaire *"Journal d'Audit"*.
2. **Pollution du DOM : Injection de JSON Brut dans le Journal d'Audit** :
   * Sur [Capture d'écran 2026-10-29 201112.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20201112.png) et [193840.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193840.png), le journal affichait textuellement :
     `{"action":"FIRST_RUN_SETUP","companyName":"Global Maintenance","adminEmail":"admin@gmail.com"}`
   * **Correctif** : Analyse sémantique dans [apps/desktop/app/actions/dashboard.actions.ts](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/app/actions/dashboard.actions.ts#L108-L125) pour convertir ce JSON en texte clair : *"Initialisation de l'espace (Global Maintenance)"*.
3. **Coupure des Métriques Supérieures au Rendu Initial** :
   * Lors du premier chargement, le haut des conteneurs de graphiques chevauche la zone haute avant que les styles ne soient complètement stabilisés.

---

### Flux C : Facturation, Devis et Notes d'Avoir (`192452` à `193411`)

1. **L'Empty State Mensonger sur le Filtre des Factures** :
   * Sur [Capture d'écran 2026-10-29 192823.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20192823.png), l'utilisateur filtre les factures sur "Payées" (alors qu'aucune n'est encore payée).
   * L'application affiche : *"LES FACTURES SONT GÉNÉRÉES AUTOMATIQUEMENT APRÈS LA CONVERSION D'UN DEVIS ACCEPTÉ"*.
   * Ce message est trompeur car :
     1. L'utilisateur a déjà des factures émises, simplement aucune n'est encore au statut "Payée".
     2. L'application permet la création directe de factures via le bouton "+ Nouvelle facture".
   * **Correctif** : Remplacement par un message contextuel dans [apps/desktop/components/pages/invoices/InvoiceViews.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/components/pages/invoices/InvoiceViews.tsx#L202-L212).
2. **Asymétrie Visuelle de l'Empty State des Avoirs** :
   * Sur [Capture d'écran 2026-10-29 193252.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193252.png) (vue tableau), la table vide affichait une simple ligne de texte *"Aucun avoir émis."* reléguée au fond du tableau, sans icône ni bouton d'action.
   * Sur [Capture d'écran 2026-10-29 193354.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193354.png) (vue cartes), l'état vide était parfaitement centré et documenté.
   * **Correctif** : Harmonisation de la vue tableau dans [apps/desktop/components/features/credit-notes/CreditNoteViews.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/components/features/credit-notes/CreditNoteViews.tsx#L125-L132).
3. **Placeholders Tronqués** :
   * *"Rechercher par numéro d'avoir, client, numéro de fact"* (fin coupée dans l'input).
   * *"Filtrer par utilisateur, actio"* (lettre n coupée dans le journal d'audit).

---

### Flux D : Gouvernance, Utilisateurs et Journal d'Audit (`193707`, `193800`, `193840`)

1. **Tronquature du Sélecteur de Statut** :
   * Sur [Capture d'écran 2026-10-29 193707.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193707.png), le bouton de dropdown affiche *"Tous les statutv"* en raison d'une largeur fixe insuffisante avant la flèche chevron.
2. **Colonne "Date & Heure" Incomplète** :
   * Sur [Capture d'écran 2026-10-29 193800.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193800.png), le titre de colonne annonce *"Date & Heure"*, mais seules les dates (`29/10/2026`) sont rendues, omettant l'heure précise indispensable pour un audit légal.
3. **Scrollbars Natives Windows Invasives** :
   * Les barres de défilement par défaut de Windows (grises et épaisses) empiètent sur les marges intérieures des tableaux et viennent frôler les boutons d'action d'en-tête (notamment dans la page Paramètres sur [Capture 193908.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20193908.png)).

---

### Flux E : Authentification & Paramètres (`193908`, `194033`, `194132`)

1. **Faute d'Orthographe / Typographie** :
   * Sur [Capture d'écran 2026-10-29 194132.png](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/sceenshorts/Capture%20d'%C3%A9cran%202026-10-29%20194132.png), le menu du thème affichait *"Systeme"* sans accent.
   * **Correctif** : Corrigé en *"Système"* dans [apps/desktop/components/theme-toggle.tsx](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/apps/desktop/components/theme-toggle.tsx#L93).
2. **Faux Indicateur de Notification (Dark Pattern involontaire)** :
   * L'icône de cloche en haut à droite affiche en permanence un point rouge vif, incitant l'utilisateur à cliquer pour voir ses notifications en attente.
   * Au clic, aucun centre de notification interactif ne s'ouvre, ce qui crée une frustration utilisateur récurrente.

---

## 4. INVENTAIRE MÉTHODIQUE DES ANOMALIES, ZOMBIES ET PARASITES

| Type | Identifiant | Description Détaillée | Fichier Source / Capture | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **ZOMBIE** | `ZMB-01` | Timer orphelin de 15s détruisant la fenêtre pendant l'impression native Windows | `apps/desktop/main/ipc.js` (`192711.png`) | **RÉSOLU** |
| **ZOMBIE** | `ZMB-02` | Gestion de `print({ silent: false })` considérant le clic "Annuler" comme un crash | `apps/desktop/main/ipc.js` (`192723.png`) | **RÉSOLU** |
| **PARASITE** | `PAR-01` | Bruit de console Crashpad Win32 `(0x2) CreateFile` en développement | `apps/desktop/main.js` | **RÉSOLU** |
| **PARASITE** | `PAR-02` | Bouton CTA géant orange fluorescent `AJOUTER UN UTILISATEUR` sur le Dashboard | `apps/desktop/components/dashboard/admin.tsx` | **RÉSOLU** |
| **PARASITE** | `PAR-03` | Injection de JSON brut non désérialisé dans la timeline du Dashboard | `apps/desktop/app/actions/dashboard.actions.ts` | **RÉSOLU** |
| **PARASITE** | `PAR-04` | Overlay d'avertissement Next.js Dev (`(!) 1 Issue ✕`) persistant sur l'UI | Rendu client Electron (`192744.png`) | **IDENTIFIÉ** |
| **PARASITE** | `PAR-05` | Badge rouge permanent sur l'icône de cloche de notification sans tiroir actif | Barre d'en-tête globale (`201112.png`) | **DOCUMENTÉ** |
| **ANOMALIE** | `ANO-01` | Empty state mensonger affirmant que les factures proviennent uniquement de devis | `apps/desktop/components/pages/invoices/InvoiceViews.tsx` | **RÉSOLU** |
| **ANOMALIE** | `ANO-02` | Empty state de la table des Avoirs relégué en bas de conteneur | `CreditNoteViews.tsx` (`193252.png`) | **RÉSOLU** |
| **ANOMALIE** | `ANO-03` | Erreur d'orthographe *"Systeme"* dans le sélecteur de thème | `apps/desktop/components/theme-toggle.tsx` | **RÉSOLU** |
| **ANOMALIE** | `ANO-04` | Débordement vertical de l'onboarding masquant le bouton d'action et les champs | `apps/desktop/components/pages/setup.tsx` (`200439.png`) | **DOCUMENTÉ** |
| **ANOMALIE** | `ANO-05` | Placeholders de recherche tronqués par manque de largeur responsive | `credit-notes.tsx`, `audit.tsx` | **DOCUMENTÉ** |
| **ANOMALIE** | `ANO-06` | Colonne "Date & Heure" du Journal d'Audit n'affichant pas l'horodatage horaire | `apps/desktop/components/pages/audit.tsx` | **DOCUMENTÉ** |
| **MAUVAISE PRATIQUE** | `MPR-01` | Hardcoding de classes utilitaires Tailwind non sémantiques (`bg-amber-500`) | Composants Dashboard | **CORRIGÉ** |
| **MAUVAISE PRATIQUE** | `MPR-02` | Scrollbars natives du système d'exploitation dégradant le design épuré | CSS global et conteneurs overflow | **DOCUMENTÉ** |
| **MAUVAISE PRATIQUE** | `MPR-03` | Fichier `admin.tsx` dépassant le seuil de modularité recommandé (490 lignes) | `apps/desktop/components/dashboard/admin.tsx` | **DOCUMENTÉ** |

---

## 5. PLAN D'ACTION CURATIF & RECOMMANDATIONS FUTURES

### 5.1. Actions Déjà Mises en Œuvre avec Succès
1. **Sécurisation de l'impression native** : Déarmement du timer dès le chargement HTML et retour pacifié sur annulation utilisateur.
2. **Suppression du bruit Crashpad** : Ajout du switch `--disable-crash-reporter` sous Windows.
3. **Assainissement du Dashboard** :
   * Refonte de la barre d'action inférieure en 3 boutons hiérarchisés et conformes aux couleurs du design system.
   * Parsing intelligent des payloads JSON dans la timeline d'audit.
4. **Correction des Empty States** : Message contextuel et exact sur les factures et les notes d'avoir.
5. **Harmonisation typographique** : Correction de *"Système"* avec accent et attributs d'accessibilité `sr-only`.

### 5.2. Recommandations pour le Prochain Lot d'Évolution
1. **Stylisation globale des scrollbars** : Intégrer un style CSS fin (`scrollbar-thin scrollbar-thumb-muted-foreground/20`) dans `globals.css` pour homogénéiser l'aspect visuel sous Windows.
2. **Pied de page sticky sur l'Onboarding** : Encadrer les boutons d'action de l'assistant d'installation dans un conteneur fixé en bas de viewport pour éviter tout masquage sur les petits écrans d'ordinateur portable.
3. **Comportement de la cloche de notification** : Lier la pastille rouge à la présence réelle de factures en retard (`overdueCount > 0`) et ouvrir un popover déroulant les alertes de trésorerie au clic.
4. **Découpage modulaire de `DashboardAdmin`** : Extraire la section graphique (`DashboardRevenueChart.tsx`) et la section d'audit (`DashboardActivityTimeline.tsx`) pour ramener le composant principal sous le seuil de 350 lignes.

---
*Fin du rapport d'audit — Fichier consigné sous `docs/rapport/04_AUDIT_LOGS_INTERFACES_ET_ZOMBIES.md`.*

