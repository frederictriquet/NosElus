CREATE TABLE IF NOT EXISTS "search_synonyms" (
  "term"        VARCHAR(50)  PRIMARY KEY,
  "expansion"   TEXT         NOT NULL,
  "created_at"  TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Données initiales : acronymes parlementaires et sociaux courants
INSERT INTO "search_synonyms" ("term", "expansion") VALUES
  ('SMIC',  'salaire minimum interprofessionnel de croissance'),
  ('TVA',   'taxe sur la valeur ajoutée'),
  ('CSG',   'contribution sociale généralisée'),
  ('CRDS',  'contribution au remboursement de la dette sociale'),
  ('PLF',   'projet de loi de finances'),
  ('PLFSS', 'projet de loi de financement de la sécurité sociale'),
  ('PMA',   'procréation médicalement assistée'),
  ('IVG',   'interruption volontaire de grossesse'),
  ('GPA',   'gestation pour autrui'),
  ('ZFE',   'zone à faibles émissions'),
  ('RIC',   'référendum d initiative citoyenne'),
  ('APL',   'aide personnalisée au logement'),
  ('RSA',   'revenu de solidarité active'),
  ('AAH',   'allocation adultes handicapés'),
  ('AME',   'aide médicale état'),
  ('HLM',   'habitation à loyer modéré'),
  ('CDD',   'contrat à durée déterminée'),
  ('CDI',   'contrat à durée indéterminée')
ON CONFLICT ("term") DO NOTHING;
