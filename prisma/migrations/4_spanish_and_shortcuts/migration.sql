-- Spanish display names (empty = falls back to the Portuguese name)
ALTER TABLE "Package" ADD COLUMN "nameEs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Package" ADD COLUMN "tooltipEs" TEXT DEFAULT '';
ALTER TABLE "Category" ADD COLUMN "displayNameEs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Skill" ADD COLUMN "nameEs" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Variable" ADD COLUMN "labelEs" TEXT NOT NULL DEFAULT '';

-- Framework shortcuts (Training / Workshop / Go-live)
ALTER TABLE "Package" ADD COLUMN "moduleLink" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Package" ADD COLUMN "goLiveShortcutQty" INTEGER NOT NULL DEFAULT 0;

-- Pre-fill: Workshop / Training items are linked to the module whose name
-- appears in the item name (longest match wins). Items without a match stay
-- unlinked and can be linked in Admin › Library.
WITH item_phase AS (
  SELECT p.id, lower(p.name) AS item_name,
         COALESCE(par."implementationPhase", pc."implementationPhase") AS phase
  FROM "Package" p
  JOIN "Category" pc ON pc.name = p."categoryName"
  LEFT JOIN "Category" par ON par.name = pc."parentName" AND par."isActive"
),
modules AS (
  SELECT c.name,
         lower(c.name) AS full_name,
         lower(NULLIF(c."displayName", '')) AS display_name,
         lower(regexp_replace(c.name, '^zendesk\s+', '', 'i')) AS short_name
  FROM "Category" c
  WHERE c."isActive" AND c."parentName" IS NULL AND c."implementationPhase" = 'SETUP'
),
matches AS (
  SELECT DISTINCT ON (ip.id) ip.id, m.name
  FROM item_phase ip
  JOIN modules m ON (
       ip.item_name LIKE '%' || m.full_name || '%'
    OR (m.display_name IS NOT NULL AND ip.item_name LIKE '%' || m.display_name || '%')
    OR (m.short_name ~ '^[a-z0-9 ]+$' AND ip.item_name ~ ('\m' || m.short_name || '\M'))
  )
  WHERE ip.phase IN ('WORKSHOP', 'TRAINING')
  ORDER BY ip.id, length(m.full_name) DESC
)
UPDATE "Package" p SET "moduleLink" = matches.name
FROM matches WHERE p.id = matches.id;

-- Pre-fill: in Go-Live categories, "post go-live" items get 3 and "go-live"
-- items get 1 (an item that starts with "go-live" counts as go-live).
UPDATE "Package" p SET "goLiveShortcutQty" = CASE
    WHEN translate(lower(p.name), 'óô', 'oo') !~ '^\s*go[ -]?live'
         AND translate(lower(p.name), 'óô', 'oo') ~ '(pos[ -]?go|post[ -]?go)' THEN 3
    WHEN lower(p.name) ~ 'go[ -]?live' THEN 1
    ELSE 0
  END
FROM "Category" pc
LEFT JOIN "Category" par ON par.name = pc."parentName" AND par."isActive"
WHERE pc.name = p."categoryName"
  AND COALESCE(par."implementationPhase", pc."implementationPhase") = 'GOLIVE';
