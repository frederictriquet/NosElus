# Analyse - Phase 2.2 : Implication individuelle par texte

## Date : 2026-02-01

## Problème
Afficher l'implication active des élus dans les textes de loi : cosignatures, amendements déposés, votes. Passage d'une logique "a voté" à "a contribué activement".

## État actuel des données

### Infrastructure DB existante
- ✅ Table `laws` : 12 164 dossiers (PJL, PPL, résolutions)
- ✅ Table `amendments` : 35 amendements (mais `law_id` NULL)
- ✅ Table `scrutins` : Colonne `lawId` existe mais NULL
- ✅ Relations Drizzle définies

### Données manquantes
- ❌ `scrutins.lawId` non renseigné (17k+ scrutins)
- ❌ `amendments.lawId` non renseigné
- ❌ Pas de table `law_cosignatories` (co-auteurs)
- ❌ Pas de données "prises de parole"

## Dépendances bloquantes

**Phase 2.1 NON implémentée** : "Trajectoire des textes de loi"
- Modèle de données dossier législatif
- ETL import dossiers
- Lien scrutins ↔ dossiers

Sans Phase 2.1, impossible de faire Phase 2.2 complète.

## Schéma proposé pour cosignatures

```sql
CREATE TABLE law_cosignatories (
  law_id VARCHAR(50) REFERENCES laws(id),
  actor_id VARCHAR(20) REFERENCES actors(id),
  role VARCHAR(20), -- 'author' | 'cosignatory'
  signature_order INT,
  PRIMARY KEY (law_id, actor_id)
);

CREATE INDEX law_cosignatories_law_idx ON law_cosignatories(law_id);
CREATE INDEX law_cosignatories_actor_idx ON law_cosignatories(actor_id);
```

## Options identifiées

### Option A : Phase 2.1 d'abord (recommandé roadmap)
**Effort** : 🔴 Complexe
**Avantages** :
- Respecte dépendances
- Infrastructure complète

**Inconvénients** :
- Long (ETL XML/JSON complexe)
- Bloque Phase 2.2

### Option B : Version simplifiée sans Phase 2.1
**Scope réduit** :
- Juste amendements existants + votes
- Pas de cosignatures
- Pas de page `/an/textes/[id]`

**Avantages** :
- Rapide
- Apporte valeur immédiate

**Inconvénients** :
- Incomplet
- Dette technique

### Option C : Passer à autre chose
**Alternative** : Terminer Priorité 1 (documentation méthodologique)

## Leçons apprises

1. **Vérifier dépendances** : Phase 2.2 ne peut pas être faite avant 2.1
2. **État des données** : Schema existe mais données ETL manquantes
3. **Priorités roadmap** : Respecter l'ordre des phases ou justifier le changement

## Recommandation

**Consulter l'utilisateur** pour choisir :
1. Implémenter Phase 2.1 d'abord (gros chantier)
2. Version light de 2.2 (sans cosignatures)
3. Terminer Priorité 1 avant Priorité 2
