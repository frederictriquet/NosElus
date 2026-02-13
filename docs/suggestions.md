# Suggestions : Matching Lois AN ↔ Légifrance

## Contexte initial

Suggestions externes pour remplacer le matching Jaccard (titres) par des identifiants stables (NOR/ELI).

## Investigation technique (2026-02-12)

### Diagnostic réel

L'investigation sur les données réelles a révélé que le "problème" de 47.6% de lois sans texte
n'est **PAS** un échec de matching mais un fait structurel :

| Catégorie                                            | Nombre | % des sans texte |
| ---------------------------------------------------- | ------ | ---------------- |
| Propositions jamais promulguées (texte n'existe pas) | 2034   | 94.1%            |
| IDs TXT17\* (textes individuels, pas des dossiers)   | 124    | 5.7%             |
| **Lois promulguées réellement manquantes**           | **3**  | **0.1%**         |

**Le matching Jaccard actuel a un taux de réussite de 99.9%** sur les lois promulguées.

### Disponibilité des identifiants dans les données AN

Les identifiants NOR, codeLoi, urlLegifrance sont présents dans les données
@tricoteuses/assemblee, mais **uniquement dans les actes PROM-PUB** (lois promulguées) :

- `acteLegislatif.infoJO.referenceNOR` : 61/2213 dossiers leg-17
- `acteLegislatif.codeLoi` : 61/2213
- `acteLegislatif.infoJO.urlLegifrance` : 61/2213

Ces identifiants ne peuvent résoudre que 3 lois supplémentaires.

### Actions retenues

- **A. Récupérer les 3 lois manquantes par NOR** (1 jour) ✅
- **B. Distinguer "non promulguée" vs "texte manquant" dans le dashboard** (1-2 jours) ✅

### Options rejetées

- **Basculer vers identifiants stables** : effort disproportionné (+3 lois pour 7-10 jours)
- **Améliorer Jaccard** : gain marginal (~37 lois à score 0.35-0.40)
- **Dumps JORF/LEGI bulk** : over-engineering (~20 GB pour +3 lois)
- **DOSLEG Sénat** : non investigué, probablement même conclusion

---

## Suggestions originales (pour référence)

Les sources open data fiables (stables, officielles, avec identifiants persistants) pour
récupérer le texte intégral des lois et faire une association déterministe avec les dossiers
parlementaires :

### 1) Sources de vérité pour le texte intégral promulgué

**A. Légifrance via PISTE (DILA)** — source canonique déjà utilisée.
API stable via PISTE depuis avril 2023. Identifiants juridiques NOR/ELI/LEGI.

**B. Dumps Open Data DILA (JORF/LEGI)** — mode offline/reproductible.
Stocks publiés sur data.gouv.fr (JORF "Lois et décrets").

> Attention : l'API journal-officiel.gouv.fr (OpenDataSoft) sert surtout JOAFE/BALO.

### 2) Sources côté parcours parlementaire

**A. Open Data Assemblée nationale** — Dossiers législatifs (JSON/XML).
Dataset contenant les notices des documents des dossiers (PPL/PJL, textes adoptés, etc.).

**B. Open Data Sénat (DOSLEG)** — cross-check.
Base DOSLEG avec exports de lois promulguées, historique depuis 1995.

**C. Dossiers législatifs côté Légifrance** — identifiants NOR dans les libellés.

**D. APIs/agrégateurs civiques** — ParlAPI/NosDéputés, source non canonique.

### 3) Clés d'identification (par ordre de solidité)

1. NOR (ex: "ECOI2433756L")
2. ELI (European Legislation Identifier)
3. Numéro de loi + date de promulgation
4. Référence JORF

### 4) Pipeline recommandé (non retenu)

1. Identifier l'élément "loi promulguée" dans le dossier AN
2. Extraire un identifiant (NOR/URL/numéro+date)
3. Interroger Légifrance API par NOR/ELI
4. Fallback DOSLEG Sénat
5. Fallback stocks DILA (JORF/LEGI)

Non retenu car ne résout que 3 lois supplémentaires (effort disproportionné).
