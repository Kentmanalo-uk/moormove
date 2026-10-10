-- E-MOORM orders as MoorMove jobs. Each job says where it came from
-- (MoorMove or E-MOORM) and, for E-MOORM, the order id and number. open_ref
-- holds the order id only while the job is open (MySQL allows many NULLs in a
-- unique index), so an order never has two open jobs. partner_events is the
-- outbox of updates sent to E-MOORM.

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `source` ENUM('MOORMOVE', 'EMOORM') NOT NULL DEFAULT 'MOORMOVE',
    ADD COLUMN `external_ref` VARCHAR(64) NULL,
    ADD COLUMN `external_code` VARCHAR(40) NULL,
    ADD COLUMN `open_ref` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `jobs_open_ref_key` ON `jobs`(`open_ref`);

-- CreateIndex
CREATE INDEX `jobs_external_ref_idx` ON `jobs`(`external_ref`);

-- CreateTable
CREATE TABLE `partner_events` (
    `id` VARCHAR(191) NOT NULL,
    `job_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `payload` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sent_at` DATETIME(3) NULL,
    `gave_up_at` DATETIME(3) NULL,
    `last_error` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `partner_events_sent_at_next_attempt_at_idx`(`sent_at`, `next_attempt_at`),
    INDEX `partner_events_job_id_created_at_idx`(`job_id`, `created_at`),
    INDEX `partner_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `partner_events` ADD CONSTRAINT `partner_events_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
