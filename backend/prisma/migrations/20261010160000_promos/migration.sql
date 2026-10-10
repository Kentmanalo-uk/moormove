-- Free-delivery promos, set by MoorMove's admin. While one runs (active, now
-- between starts_at and ends_at, the pickup town in town_ids or town_ids
-- NULL for all towns, the distance within max_km when set), deliveries cost
-- the buyer nothing: the job's fee is 0, list_fee keeps the usual fee, the
-- rider still earns their usual share, and platform_cut is negative (MoorMove
-- owes the rider), so settling cash nets it out.

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `list_fee` DECIMAL(10, 2) NULL,
    ADD COLUMN `promo_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `promos` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `note` VARCHAR(255) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NULL,
    `town_ids` JSON NULL,
    `max_km` DECIMAL(6, 2) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `promos_active_starts_at_idx`(`active`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `jobs_promo_id_idx` ON `jobs`(`promo_id`);

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_promo_id_fkey` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promos` ADD CONSTRAINT `promos_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

