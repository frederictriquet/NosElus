#!/bin/bash
# Script pour télécharger les données nettoyées de l'Assemblée Nationale
# Source: https://git.en-root.org/tricoteuses/data/assemblee-nettoye

set -e

DATA_DIR="${ETL_DATA_DIR:-./data/assemblee}"

echo "============================================================"
echo "NosElus - Téléchargement des données Assemblée Nationale"
echo "============================================================"
echo "Répertoire de destination: $DATA_DIR"
echo ""

if [ -d "$DATA_DIR/.git" ]; then
    echo "--- Mise à jour des données existantes ---"
    cd "$DATA_DIR"
    git pull
else
    echo "--- Clonage du dépôt de données (peut prendre plusieurs minutes) ---"
    echo "Source: https://git.en-root.org/tricoteuses/data/assemblee-nettoye"
    git clone --depth 1 https://git.en-root.org/tricoteuses/data/assemblee-nettoye.git "$DATA_DIR"
fi

echo ""
echo "============================================================"
echo "Téléchargement terminé!"
echo "============================================================"
echo ""
echo "Taille des données:"
du -sh "$DATA_DIR"
echo ""
echo "Pour lancer l'import ETL:"
echo "  export ETL_DATA_DIR=$DATA_DIR"
echo "  npm run etl:an-all"
echo ""
