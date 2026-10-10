-- Where riders deliver. rider_areas holds the places a rider picked: a whole
-- town (barangay NULL) or single barangays of a town. A rider with no rows
-- delivers in their whole home town, as before. A job is offered to a rider
-- only when both its pickup and its drop-off are in the rider's places, so
-- jobs now also say which town the drop-off is in (dropoff_town_id; NULL on
-- older jobs means the pickup's town).

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `dropoff_town_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `rider_areas` (
    `id` VARCHAR(191) NOT NULL,
    `rider_id` VARCHAR(191) NOT NULL,
    `town_id` VARCHAR(191) NOT NULL,
    `barangay` VARCHAR(80) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rider_areas_town_id_idx`(`town_id`),
    UNIQUE INDEX `rider_areas_rider_id_town_id_barangay_key`(`rider_id`, `town_id`, `barangay`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `jobs_dropoff_town_id_idx` ON `jobs`(`dropoff_town_id`);

-- AddForeignKey
ALTER TABLE `rider_areas` ADD CONSTRAINT `rider_areas_rider_id_fkey` FOREIGN KEY (`rider_id`) REFERENCES `riders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rider_areas` ADD CONSTRAINT `rider_areas_town_id_fkey` FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_dropoff_town_id_fkey` FOREIGN KEY (`dropoff_town_id`) REFERENCES `towns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
