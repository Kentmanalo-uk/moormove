-- A failed E-MOORM delivery has a way back: after pickup the job goes to
-- RETURNING (the rider brings the parcel back to the shop) and becomes FAILED
-- with returned_at once the shop confirms it has the parcel.

-- AlterTable
ALTER TABLE `jobs` MODIFY `status` ENUM('SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNING') NOT NULL DEFAULT 'SEARCHING',
    ADD COLUMN `returned_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `job_events` MODIFY `status` ENUM('SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNING') NOT NULL;
