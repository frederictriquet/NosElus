# Standard : Contenu Français en UTF-8

## Catégorie
Content Generation / Internationalization

## Date d'adoption
2026-02-05

## Règle

**Lors de la génération de contenu textuel en français, TOUJOURS utiliser les caractères accentués corrects (UTF-8).**

Ne jamais générer du français sans accents : `donnees` ❌ → `données` ✅

## Justification

Générer du contenu français sans accents :
- Rend le texte illisible et peu professionnel
- Est particulièrement critique pour les pages juridiques (mentions légales, RGPD)
- Viole les standards d'accessibilité (lecteurs d'écran)
- Peut avoir des implications légales (contenu juridique incorrect)

## Caractères concernés

Lettres accentuées françaises à toujours utiliser :
- **é** è ê ë (e accentués)
- **à** â (a accentués)
- **ù** û (u accentués)
- **ô** (o accent circonflexe)
- **î** ï (i accentués)
- **ç** (c cédille)
- **œ** æ (ligatures)

## Exemples

### ✅ Correct
```markdown
# Politique de confidentialité

Conformément au RGPD, les données collectées...
Frédéric Triquet
Hébergeur : à compléter
Sécurité
```

### ❌ Incorrect
```markdown
# Politique de confidentialite

Conformement au RGPD, les donnees collectees...
Frederic Triquet
Hebergeur : a completer
Securite
```

## Vérification

### Après génération de contenu
```bash
# Vérifier présence d'accents dans un fichier français
grep -P '[éèêëàâùûôîïçœæ]' file.md

# Si aucun résultat → erreur, le fichier n'a pas d'accents !
```

### Recherche de fichiers sans accents
```bash
# Trouver les fichiers français suspects (aucun caractère accentué)
find src/routes -name "*.svelte" -type f -exec sh -c \
  'grep -qP "[éèêëàâùûôîïçœæ]" "$1" || echo "$1"' _ {} \;
```

## Exceptions

Aucune. Même les acronymes et noms propres doivent respecter l'orthographe française correcte.

## Origine

Session EU Compliance 2026-02-05 : 2 pages légales (310 lignes) générées sans aucun accent, détecté en code review (blocker).

## Voir aussi

- `lessons-learned-2026-02-05-eu-compliance.md`
- Encoding du projet : UTF-8 (`.editorconfig`, `tsconfig.json`)
