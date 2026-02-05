on me montre une liste de textes, je réponds pour/contre
et ça me donne ma tendance politique


réussir à classifier les textes par grands thèmes, comprendre de quoi ça parle, par ex : un texte parle d'avortement, mais il peut soit restreindre soit augmenter les droits, donc il faut le prendre en compte car ce n'est pas pareil de voter pour ou contre le texte





Les photos sont chargées directement depuis assemblee-nationale.fr. Plusieurs optimisations sont possibles :
1. Court terme : Ajouter loading="lazy" et dimensions fixes aux images
2. Moyen terme : Proxy avec cache côté serveur
3. Long terme : Télécharger les photos localement pendant l'ETL



il faudrait pouvoir accéder aux propositions de loi par thèmes, par dates -> on accède aux lois dont les sujets peuvent nous intéresser et voir qui vote quoi sur ces lois

où sont stockés les tags des articles ? dans une table de tags ? -> donner la possibilité de filter sur les tags quand on cherche des articles

rendre toutes les migrations de db idempotentes


faire un stacked bar pour la répartition des votes

sur /an/scrutin/xxx on peut enlever stats-grid puisqu'on a la répartition des votes

dans "Répartition par position" on peut supprimer la rotation des labels (mais pas dans "Votes par groupes")

sur toutes les pages et dans tous les composants ou on affiche le nom court d'un parti, je veux qu'on affiche le nom long lorsque l'on hover avec la souris : inspire-toi de ce qui a été fait dans le composant ElectedCard.svelte au niveau du group-name-hover et fais-en un sous-composant réutilisable


l'import des données en base demande beaucoup de travail (récupération de fichiers, consultation de endpoints d'api, et maintenant une phase d'analyse par IA), je voudrais pouvoir préparer toutes les données en local, sur un ordinateur assez puissant pour tout faire, et pouvoir envoyer ces données vers le serveur de prod. Il faudrait que ça puisse fonctionner de manière incrémentale.


make etl-law-texts
make etl-analyze-laws ARGS="--limit 5"

combien de lois avec un texte
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(*) as with_text FROM laws WHERE description IS NOT NULL;"

combien de loi avec un résumé IA
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(*) as with_summary FROM law_summaries;"

lois avec un résumé IA avec ou sans texte complet
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(*) as with_summary_and_text FROM law_summaries ls JOIN laws l ON ls.law_id = l.id WHERE l.description IS NOT NULL;"
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT COUNT(*) as summary_without_text FROM law_summaries ls JOIN laws l ON ls.law_id = l.id WHERE l.description IS NULL;" 


donne la requête qui liste toutes les pages permettant d'accéder aux textes avec un résumé IA
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT '/an/laws/' || l.id as url, l.short_title FROM law_summaries ls JOIN laws l ON ls.law_id = l.id ORDER BY l.deposit_date DESC;"

Ou pour les pages scrutins liés :
docker exec noselus-postgres psql -U noselus -d noselus -c "SELECT '/an/scrutins/' || s.id as url, s.title FROM scrutins s JOIN laws l ON s.law_id = l.id JOIN law_summaries ls ON ls.law_id = l.id ORDER BY s.date DESC LIMIT 50;"

make etl-analyze-laws ARGS="--limit 1 -r TXT17639VV1 --model mistral-nemo"




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
