-- AlterTable
ALTER TABLE "Category" ADD COLUMN "implementationPhase" TEXT NOT NULL DEFAULT 'SETUP';

-- Pre-fill from the category names the calculation used to match in code
-- (workshop > treinamento > go-live, accent- and case-insensitive), so no hours
-- move between the Implementation lines after the hardcoded rule is removed.
UPDATE "Category" SET "implementationPhase" = 'GOLIVE'
WHERE translate(lower("name"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE ANY (ARRAY['%go-live%', '%go live%', '%pos go%']);

UPDATE "Category" SET "implementationPhase" = 'TRAINING'
WHERE translate(lower("name"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%treinamento%';

UPDATE "Category" SET "implementationPhase" = 'WORKSHOP'
WHERE translate(lower("name"), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE '%workshop%';
