traite le TODO de src/routes/api/quiz/group-votes/+server.ts:98

dans le dashboard de stats globales, je vois qu'il y a 100% des textes du parlement européen qui ont été analysés par IA alors qu'il y a 0% des textes complets. Je croyais qu'il était interdit d'analyser des lois sans avoir leur texte complet

IN scope :

- Aligner la définition de "texte complet" entre dashboard et ETL LLM
- Empêcher la génération de résumés sans texte complet réel
- Nettoyer les 1190 résumés PE générés sans texte complet (PE-10: 364, PE-9: 821, PE-8: 5)
- Documenter la règle : pas de résumé LLM si length(description) <= 100

OUT of scope :

- Récupération du vrai texte complet des lois PE (nécessite intégration EUR-Lex, ADR séparée)
- Régénération des résumés après récupération des textes (sera fait après EUR-Lex)

Contraintes

1. Convention existante : Le dashboard utilise length(description) > 100 comme définition de "texte complet"
2. Cohérence : Le seuil de 100 chars est utilisé partout (AN, Sénat, PE)
3. Données PE : Actuellement aucune loi PE n'a de vrai texte complet dans la DB

Critères d'Acceptation

- getUnanalyzedLaws() utilise le même seuil que le dashboard (length(description) > 100)
- Dashboard affiche 100% cohérence entre "textes complets" et "résumés IA"
- Les 1190 résumés PE existants (paraphrases de titres) sont supprimés
- Les stats du dashboard affichent 0% sur les deux colonnes pour PE

Les photos sont chargées directement depuis assemblee-nationale.fr. Plusieurs optimisations sont possibles :

1. Court terme : Ajouter loading="lazy" et dimensions fixes aux images
2. Moyen terme : Proxy avec cache côté serveur
3. Long terme : Télécharger les photos localement pendant l'ETL

Limites actuelles (visibles dans le code) :

- Pas de pondération : les abstentions et non-votants sont ignorés. Un groupe avec 2 pour / 1 contre / 50
  abstentions est compté "pour"
- En cas d'égalité (pour === contre), c'est "contre" par défaut (le > strict)
- S'il y a plusieurs scrutins par loi, seul le premier trouvé est utilisé (il y a d'ailleurs un TODO dans
  le code : // TODO : Si plusieurs scrutins par loi, prendre le scrutin "vote final")
- Les données JSONB groupResults sont pré-calculées à l'import ETL, pas recalculées à la volée

l'import des données en base demande beaucoup de travail (récupération de fichiers, consultation de endpoints d'api, et maintenant une phase d'analyse par IA), je voudrais pouvoir préparer toutes les données en local, sur un ordinateur assez puissant pour tout faire, et pouvoir envoyer ces données vers le serveur de prod. Il faudrait que ça puisse fonctionner de manière incrémentale.

utilise le FemtoLogger https://github.com/frederictriquet/FemtoLogger pour logger des événements dans Telegram.
Evénements à logger: la fin de n'importe quel ETL

make etl-an-law-texts
make etl-analyze-laws ARGS="--limit 5"

combien de lois avec un texte
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(\*) as with_text FROM laws WHERE description IS NOT NULL;"

combien de loi avec un résumé IA
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(\*) as with_summary FROM law_summaries;"

lois avec un résumé IA avec ou sans texte complet
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(_) as with_summary_and_text FROM law_summaries ls JOIN laws l ON ls.law_id = l.id WHERE l.description IS NOT NULL;"
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(_) as summary_without_text FROM law_summaries ls JOIN laws l ON ls.law_id = l.id WHERE l.description IS NULL;"

donne la requête qui liste toutes les pages permettant d'accéder aux textes avec un résumé IA
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT '/an/laws/' || l.id as url, l.short_title FROM law_summaries ls JOIN laws l ON ls.law_id = l.id ORDER BY l.deposit_date DESC;"

Ou pour les pages scrutins liés :
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT '/an/scrutins/' || s.id as url, s.title FROM scrutins s JOIN laws l ON s.law_id = l.id JOIN law_summaries ls ON ls.law_id = l.id ORDER BY s.date DESC LIMIT 50;"

make etl-analyze-laws ARGS="--limit 1 -r TXT17639VV1 --model mistral-nemo"

make etl-europarl-laws
make etl-europarl-votes

[16/100] Analyzing: TXT171SFCQR - gouvernement et aux amendements identiques suivant...
→ Error: The operation was aborted due to timeout
[17/100] Analyzing: TXT174JSIFK - projet de loi autorisant la ratification de la rés...
→ Error: The operation was aborted due to timeout
[19/100] Analyzing: SEN-pjl24-788 - projet de loi autorisant l'approbation de l'accord...
→ Error: The operation was aborted due to timeout
[20/100] Analyzing: TXT175LNUE4 - proposition de loi portant reconnaissance de la na...
→ Error: The operation was aborted due to timeout
[23/100] Analyzing: SEN-pjl24-600 - projet de loi portant transposition des accords na...
→ Error: The operation was aborted due to timeout
[24/100] Analyzing: SEN-ppl24-675 - proposition de loi élevant Alfred Dreyfus au grade...
→ Error: The operation was aborted due to timeout
[29/100] Analyzing: SEN-ppl24-677 - proposition de loi visant à garantir un cadre fisc...
→ Error: The operation was aborted due to timeout
[30/100] Analyzing: TXT172L4K9A - proposition de loi visant à réformer le mode d'éle...
→ Error: The operation was aborted due to timeout
[34/100] Analyzing: SEN-pjl24-533 - projet de loi autorisant l'approbation de l'accord...
→ Error: The operation was aborted due to timeout
[38/100] Analyzing: SEN-pjl24-345 - projet de loi autorisant l'approbation de l'accord...
→ Error: The operation was aborted due to timeout
[42/100] Analyzing: SEN-ppl24-298 - proposition de loi visant à faciliter le maintien ...
→ Error: The operation was aborted due to timeout
[43/100] Analyzing: SEN-ppl24-300 - proposition de loi relative à la protection social...
→ Error: The operation was aborted due to timeout
[44/100] Analyzing: TXT175DHMGU - proposition de loi visant à améliorer la prise en ...
→ Error: The operation was aborted due to timeout
[46/100] Analyzing: TXT176DDG06 - proposition de loi contre toutes les fraudes aux a...
→ Error: The operation was aborted due to timeout
[49/100] Analyzing: SEN-ppl24-504 - proposition de loi visant à modifier la définition...
→ Error: The operation was aborted due to timeout
[51/100] Analyzing: SEN-pjl24-260 - projet de loi d'urgence pour Mayotte...
→ Error: The operation was aborted due to timeout
[53/100] Analyzing: SEN-ppl24-223 - proposition de loi organique tendant à modifier le...
→ Error: The operation was aborted due to timeout
[56/100] Analyzing: SEN-ppl24-198 - proposition de loi expérimentant l'encadrement des...
→ Error: The operation was aborted due to timeout
[60/100] Analyzing: SEN-ppl24-420 - proposition de loi sur la profession d'infirmier...
→ Error: The operation was aborted due to timeout
[65/100] Analyzing: SEN-ppl24-261 - proposition de loi portant diverses mesures visant...
→ Error: The operation was aborted due to timeout
[95/100] Analyzing: SEN-ppl23-542 - proposition de loi pour améliorer la prise en char...
→ Error: The operation was aborted due to timeout

⏺ Voici le classement par fréquence de mise à jour :

Mise à jour régulière (hebdomadaire/bihebdomadaire)  
 ┌───────┬─────────────────────────┬──────────────────────────────────────────────────────────────┐  
 │ Ordre │ Target │ Ce qu'elle fait │  
 ├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤  
 │ 1 │ make etl-an-download │ Télécharge les derniers fichiers JSON AN │  
 ├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 2 │ make etl-an-incremental │ Import incrémental acteurs + scrutins + votes │
├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 3 │ make etl-an-dossiers │ Met à jour les dossiers législatifs (statuts, promulgations) │
├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 4 │ make etl-an-link-laws │ Lie les nouveaux scrutins aux dossiers │
├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 5 │ make etl-europarl-votes │ Nouveaux votes du Parlement Européen │
├───────┼─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 6 │ make etl-europarl-laws │ Nouvelles procédures PE │
└───────┴─────────────────────────┴──────────────────────────────────────────────────────────────┘
Enrichissement (après chaque import)
┌───────┬────────────────────────────────┬────────────────────────────────────────────────────────────────────┐
│ Ordre │ Target │ Ce qu'elle fait │
├───────┼────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 7 │ make etl-an-law-texts │ Récupère les textes Légifrance pour les nouvelles lois promulguées │
├───────┼────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 8 │ make etl-europarl-law-texts │ Textes des lois PE │
├───────┼────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 9 │ make etl-an-analyze-laws │ Résumés IA des nouvelles lois AN │
├───────┼────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 10 │ make etl-europarl-analyze-laws │ Résumés IA des nouvelles lois PE │
├───────┼────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 11 │ make etl-an-classify-scrutins │ Classification sémantique des scrutins │
└───────┴────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
Mise à jour mensuelle
┌──────────────────────────────────┬────────────────────────────┐
│ Target │ Ce qu'elle fait │
├──────────────────────────────────┼────────────────────────────┤
│ make etl-an-nosdeputes-stats │ Stats activité députés │
├──────────────────────────────────┼────────────────────────────┤
│ make etl-senat-activity-stats │ Stats activité sénateurs │
├──────────────────────────────────┼────────────────────────────┤
│ make etl-europarl-activity-stats │ Stats activité eurodéputés │
├──────────────────────────────────┼────────────────────────────┤
│ make etl-senat-senators │ Nouveaux sénateurs │
└──────────────────────────────────┴────────────────────────────┘
Setup unique (rarement)

etl-colors, etl-external-colors, etl-political-positions, etl-seed-pe-positions, etl-europarl-historical, etl-senat-mandates-history — ne changent quasi jamais.
