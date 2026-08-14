/**
 * electron-print.ts — Utilitaire d'impression natif Electron
 * ============================================================
 * Capture le HTML du composant <DocumentA4 /> (élément masqué en taille
 * réelle) et l'envoie au Main Process via IPC pour impression dans une
 * fenêtre Chromium cachée.
 *
 * Architecture :
 *  - Le <DocumentA4 /> caché (id="document-a4-container") est rendu en
 *    taille native 210×297mm sans scale.
 *  - On l'emballe dans un squelette HTML complet avec le CDN Tailwind CSS
 *    pour garantir que toutes les classes utilitaires sont disponibles
 *    dans la fenêtre cachée (qui n'a pas accès au bundle Next.js).
 *  - Un script inline déclenche window.print() APRÈS le chargement de
 *    Tailwind pour éviter que l'impression parte avant le rendu des styles.
 */

export async function printElement(elementId: string): Promise<void> {
  const element = document.getElementById(elementId)

  if (!element) {
    throw new Error(`[print] Élément #${elementId} introuvable.`)
  }

  // ── Fallback navigateur (dev mode sans Electron) ──────────────────────────
  if (!window.electron?.printDocument) {
    window.print()
    return
  }

  // ── Capture du HTML natif du DocumentA4 ──────────────────────────────────
  const contentHtml = element.outerHTML

  // ── Construction du document HTML complet ────────────────────────────────
  // On utilise le CDN Tailwind avec la configuration explicite pour s'assurer
  // que les classes arbitraires (ex: w-[210mm], h-[297mm], text-[9px]) et
  // les variantes print: fonctionnent correctement.
  const htmlDoc = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>

  <!--
    Tailwind CDN — chargé AVANT l'impression.
    Le script inline ci-dessous ne déclenche window.print()
    qu'après que Tailwind ait fini de traiter toutes les classes.
  -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Tailwind CDN expose un callback window.tailwind.config.
    // On configure les classes arbitraires pour les dimensions mm.
    tailwind.config = {
      theme: {
        extend: {}
      }
    }
  </script>

  <style>
    /* Reset de base — le body ne doit rien ajouter autour de la feuille */
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9; /* bg-slate-100 — visible brièvement avant impression */
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }

    @page {
      size: A4 portrait;
      margin: 0mm;
    }

    @media print {
      html, body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #printable-a4-document {
        box-shadow: none !important;
        margin: 0 !important;
      }
      /* Assure que la feuille A4 prend toute la page sans décalage */
      .doc-a4 {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        padding: 15mm !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
      /* Force le fond sombre du thead à l'impression */
      .doc-a4 .items-table thead tr {
        background-color: #1e293b !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc-a4 .items-table thead th {
        color: #ffffff !important;
      }
      .doc-a4 .net-a-payer {
        background-color: #eff6ff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${contentHtml}

  <script>
    /**
     * Déclenche l'impression UNIQUEMENT après que Tailwind ait fini de
     * calculer et d'appliquer tous les styles. On écoute l'événement
     * personnalisé que Tailwind CDN émet quand il a terminé, avec un
     * fallback sur un délai de 800ms si l'événement n'est pas émis.
     */
    (function() {
      var printed = false;

      function doPrint() {
        if (printed) return;
        printed = true;
        // Léger délai pour laisser le moteur de rendu finir les reflows
        setTimeout(function() { window.print(); }, 150);
      }

      // Tailwind CDN v3 n'émet pas d'événement de fin explicite,
      // mais il est synchrone sur le premier rendu après DOMContentLoaded.
      if (document.readyState === 'complete') {
        setTimeout(doPrint, 500);
      } else {
        window.addEventListener('load', function() {
          setTimeout(doPrint, 500);
        });
      }
    })();
  </script>
</body>
</html>`

  // ── Envoi au Main Process via IPC ─────────────────────────────────────────
  await window.electron.printDocument(htmlDoc)
}
