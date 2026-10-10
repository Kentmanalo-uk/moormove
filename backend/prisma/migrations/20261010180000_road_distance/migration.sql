-- Fares now use the km by road from pickup to drop-off (an OSRM route
-- service), not the straight line × the road factor. Each job keeps how its
-- distance was found: ROAD, or ESTIMATE (the route service was out, so the
-- straight line × the road factor). Older jobs: NULL (they were estimates).

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `distance_source` VARCHAR(10) NULL;
