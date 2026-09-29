#!/bin/bash
OUTPUT_FILE="DEEP_AUDIT_REPORT.md"

echo "# 🚨 DEEP AUDIT REPORT 🚨" > "$OUTPUT_FILE"
echo "## Date: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)" >> "$OUTPUT_FILE"
echo "Recherche des types 'any':" >> "$OUTPUT_FILE"
grep -rn "any" app components lib hooks | grep -v "node_modules" | head -n 10 >> "$OUTPUT_FILE" || true
echo "Recherche des @ts-ignore:" >> "$OUTPUT_FILE"
grep -rn "@ts-ignore" app components lib hooks | grep -v "node_modules" >> "$OUTPUT_FILE" || true
echo "" >> "$OUTPUT_FILE"

echo "### 2. LOGIQUE REACT ET ANTI-PATTERNS UI" >> "$OUTPUT_FILE"
echo "Recherche des useEffect:" >> "$OUTPUT_FILE"
grep -rn "useEffect" app components lib hooks | grep -v "node_modules" | head -n 10 >> "$OUTPUT_FILE" || true
echo "Recherche des prop drilling (plus de 3 niveaux) ou utilisation de variables globales non stockées dans l'état:" >> "$OUTPUT_FILE"
# Check for fetch calls without catch or with general exceptions
echo "Recherche des fetch sans try/catch ou gestion des erreurs:" >> "$OUTPUT_FILE"
grep -rn "fetch(" app components lib hooks | grep -v "node_modules" | head -n 10 >> "$OUTPUT_FILE" || true
echo "" >> "$OUTPUT_FILE"

echo "### 3. ARCHITECTURE ELECTRON ET IPC" >> "$OUTPUT_FILE"
echo "Vérification des ipcRenderer et ipcMain dans preload.js et main.js:" >> "$OUTPUT_FILE"
grep -rn "ipcRenderer" preload.js main.js >> "$OUTPUT_FILE" || true
grep -rn "ipcMain" preload.js main.js >> "$OUTPUT_FILE" || true
echo "Recherche de removeListener:" >> "$OUTPUT_FILE"
grep -rn "removeListener" preload.js main.js >> "$OUTPUT_FILE" || true
echo "" >> "$OUTPUT_FILE"

echo "### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)" >> "$OUTPUT_FILE"
echo "Recherche de db.prepare:" >> "$OUTPUT_FILE"
grep -rn "db.prepare" app components lib hooks main.js preload.js | grep -v "node_modules" | head -n 10 >> "$OUTPUT_FILE" || true
echo "Recherche de boucles map avec requêtes N+1:" >> "$OUTPUT_FILE"
grep -rn "map(" app components lib hooks | grep -v "node_modules" | head -n 10 >> "$OUTPUT_FILE" || true
echo "Recherche des requêtes WHERE sans index:" >> "$OUTPUT_FILE"
grep -rn "WHERE" lib/db.ts | head -n 10 >> "$OUTPUT_FILE" || true

echo "Report generation initialized."
