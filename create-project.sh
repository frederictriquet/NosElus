#!/bin/bash

# Script pour créer un nouveau projet à partir du template SvelteBase
# Usage: ./create-project.sh <nom-projet> [répertoire-destination]
#
# Exemples:
#   ./create-project.sh mon-app                    # Crée dans ../mon-app
#   ./create-project.sh mon-app /path/to/projects  # Crée dans /path/to/projects/mon-app

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_success() { print_message "${GREEN}" "✓ $1"; }
print_info() { print_message "${BLUE}" "ℹ $1"; }
print_warning() { print_message "${YELLOW}" "⚠ $1"; }
print_error() { print_message "${RED}" "✗ $1"; }

print_header() {
    echo ""
    print_message "${BLUE}" "════════════════════════════════════════"
    print_message "${BLUE}" "  $1"
    print_message "${BLUE}" "════════════════════════════════════════"
    echo ""
}

# Vérifier les arguments
if [ -z "$1" ]; then
    print_error "Usage: ./create-project.sh <nom-projet> [répertoire-destination]"
    echo ""
    print_info "Exemples:"
    echo "  ./create-project.sh mon-app                    # Crée dans ../mon-app"
    echo "  ./create-project.sh mon-app /path/to/projects  # Crée dans /path/to/projects/mon-app"
    exit 1
fi

PROJECT_NAME="$1"
PROJECT_NAME_LOWER=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]')
PROJECT_NAME_PASCAL=$(echo "$PROJECT_NAME" | sed -r 's/(^|-)([a-z])/\U\2/g' 2>/dev/null || echo "$PROJECT_NAME" | sed 's/-\([a-z]\)/\U\1/g; s/^\([a-z]\)/\U\1/')

# Déterminer le répertoire de destination
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "$2" ]; then
    DEST_PARENT="$2"
else
    DEST_PARENT="$(dirname "$SOURCE_DIR")"
fi
DEST_DIR="${DEST_PARENT}/${PROJECT_NAME}"

print_header "🚀 Création du projet depuis SvelteBase"

print_info "Nom du projet: ${PROJECT_NAME}"
print_info "Source: ${SOURCE_DIR}"
print_info "Destination: ${DEST_DIR}"
echo ""

# Vérifier que le répertoire de destination n'existe pas
if [ -d "$DEST_DIR" ]; then
    print_error "Le répertoire ${DEST_DIR} existe déjà !"
    exit 1
fi

# Vérifier que le répertoire parent existe
if [ ! -d "$DEST_PARENT" ]; then
    print_error "Le répertoire parent ${DEST_PARENT} n'existe pas !"
    exit 1
fi

# Confirmation
read -p "Continuer ? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Création annulée"
    exit 0
fi

echo ""
print_header "📦 Copie des fichiers"

# Créer le répertoire de destination
mkdir -p "$DEST_DIR"

# Liste des fichiers/dossiers à exclure
EXCLUDES=(
    "node_modules"
    ".git"
    "build"
    ".svelte-kit"
    "reports"
    "coverage"
    "test-results"
    "playwright-report"
    "playwright/.cache"
    ".stryker-tmp"
    ".DS_Store"
    "Thumbs.db"
    ".env"
    ".env.local"
    ".env.development"
    ".env.production"
    "package-lock.json"
    "*.log"
    ".claude"
)

# Construire les arguments d'exclusion pour rsync
RSYNC_EXCLUDES=""
for exclude in "${EXCLUDES[@]}"; do
    RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude=$exclude"
done

print_info "Copie des fichiers (en excluant les fichiers inutiles)..."
rsync -av $RSYNC_EXCLUDES "$SOURCE_DIR/" "$DEST_DIR/"
print_success "Fichiers copiés"

echo ""
print_header "📝 Remplacement du nom du projet"

# Fonction pour remplacer dans un fichier (compatible macOS et Linux)
replace_in_file() {
    local file=$1
    local old=$2
    local new=$3

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/${old}/${new}/g" "$file" 2>/dev/null || true
    else
        sed -i "s/${old}/${new}/g" "$file" 2>/dev/null || true
    fi
}

# Liste des fichiers à modifier
FILES_TO_UPDATE=(
    "package.json"
    "release-please-config.json"
    "docker-compose.yml"
    ".env.example"
    "README.md"
    "CONTRIBUTING.md"
    "TEMPLATE_READY.md"
    "DOCKER.md"
    "docker-setup.sh"
    "init-project.sh"
    "docs/ARCHITECTURE.md"
    ".github/workflows/README.md"
    ".github/TEMPLATE_SETUP.md"
    ".github/SETUP_GITHUB.md"
)

cd "$DEST_DIR"

for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ]; then
        print_info "Mise à jour de $file..."
        # Remplacer les différentes casses
        replace_in_file "$file" "sveltebase" "$PROJECT_NAME_LOWER"
        replace_in_file "$file" "SvelteBase" "$PROJECT_NAME_PASCAL"
        replace_in_file "$file" "frederictriquet/SvelteBase" "VOTRE_USERNAME/$PROJECT_NAME"
    fi
done

# Mise à jour spécifique de package.json pour la description
if [ -f "package.json" ]; then
    replace_in_file "package.json" '"description": ""' "\"description\": \"Projet basé sur SvelteBase template\""
fi

print_success "Noms remplacés dans tous les fichiers"

echo ""
print_header "🎨 Initialisation de Git"

print_info "Initialisation d'un nouveau repository Git..."
git init
git add .
git commit -m "chore: initial setup from SvelteBase template

Project name: ${PROJECT_NAME}

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
print_success "Repository Git initialisé avec le premier commit"

echo ""
print_header "✅ Projet créé avec succès !"

echo ""
print_success "Projet '${PROJECT_NAME}' créé dans ${DEST_DIR}"
echo ""

print_info "📋 Prochaines étapes :"
echo ""
echo "  1. Aller dans le nouveau projet :"
echo "     ${GREEN}cd ${DEST_DIR}${NC}"
echo ""
echo "  2. Installer les dépendances :"
echo "     ${GREEN}npm install${NC}"
echo ""
echo "  3. Configurer l'environnement :"
echo "     ${GREEN}cp .env.example .env${NC}"
echo "     Puis éditer .env avec vos variables"
echo ""
echo "  4. Lancer le serveur de développement :"
echo "     ${GREEN}npm run dev${NC}"
echo ""
echo "  5. Créer un repository GitHub :"
echo "     ${GREEN}gh repo create ${PROJECT_NAME} --private --source=. --remote=origin --push${NC}"
echo ""

print_info "📚 Documentation disponible :"
echo "  - README.md"
echo "  - docs/ARCHITECTURE.md"
echo "  - .github/TEMPLATE_SETUP.md"
echo ""

print_success "Bon développement ! 🚀"
echo ""
