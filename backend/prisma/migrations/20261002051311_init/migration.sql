-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `role` ENUM('ADMIN', 'RIDER', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_created_at_idx`(`role`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `towns` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `service_open` BOOLEAN NOT NULL DEFAULT true,
    `synced_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `towns_name_key`(`name`),
    UNIQUE INDEX `towns_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `riders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'DRAFT',
    `town_id` VARCHAR(191) NULL,
    `barangay` VARCHAR(80) NULL,
    `vehicle_type` ENUM('TRICYCLE', 'MOTORCYCLE', 'BICYCLE') NULL,
    `plate_number` VARCHAR(20) NULL,
    `toda_name` VARCHAR(120) NULL,
    `mtop_number` VARCHAR(40) NULL,
    `license_number` VARCHAR(40) NULL,
    `selfie_upload_id` VARCHAR(191) NULL,
    `id_upload_id` VARCHAR(191) NULL,
    `license_upload_id` VARCHAR(191) NULL,
    `orcr_upload_id` VARCHAR(191) NULL,
    `vehicle_upload_id` VARCHAR(191) NULL,
    `emergency_name` VARCHAR(120) NULL,
    `emergency_phone` VARCHAR(20) NULL,
    `submitted_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `review_note` TEXT NULL,
    `is_online` BOOLEAN NOT NULL DEFAULT false,
    `last_lat` DOUBLE NULL,
    `last_lng` DOUBLE NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `riders_user_id_key`(`user_id`),
    INDEX `riders_status_submitted_at_idx`(`status`, `submitted_at`),
    INDEX `riders_town_id_status_idx`(`town_id`, `status`),
    INDEX `riders_town_id_status_is_online_idx`(`town_id`, `status`, `is_online`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uploads` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(40) NOT NULL,
    `size` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uploads_file_name_key`(`file_name`),
    INDEX `uploads_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(12) NOT NULL,
    `status` ENUM('SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'SEARCHING',
    `customer_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `town_id` VARCHAR(191) NOT NULL,
    `vehicle_type` ENUM('TRICYCLE', 'MOTORCYCLE', 'BICYCLE') NOT NULL,
    `pickup_name` VARCHAR(120) NOT NULL,
    `pickup_phone` VARCHAR(20) NOT NULL,
    `pickup_address` VARCHAR(255) NOT NULL,
    `pickup_barangay` VARCHAR(80) NOT NULL,
    `pickup_lat` DOUBLE NOT NULL,
    `pickup_lng` DOUBLE NOT NULL,
    `pickup_notes` VARCHAR(255) NULL,
    `dropoff_name` VARCHAR(120) NOT NULL,
    `dropoff_phone` VARCHAR(20) NOT NULL,
    `dropoff_address` VARCHAR(255) NOT NULL,
    `dropoff_barangay` VARCHAR(80) NOT NULL,
    `dropoff_lat` DOUBLE NOT NULL,
    `dropoff_lng` DOUBLE NOT NULL,
    `dropoff_notes` VARCHAR(255) NULL,
    `package_size` ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL,
    `package_details` VARCHAR(255) NOT NULL,
    `distance_km` DECIMAL(6, 2) NOT NULL,
    `fee` DECIMAL(10, 2) NOT NULL,
    `platform_cut` DECIMAL(10, 2) NOT NULL,
    `rider_earning` DECIMAL(10, 2) NOT NULL,
    `fee_paid_by` ENUM('SENDER', 'RECIPIENT') NOT NULL DEFAULT 'SENDER',
    `cod_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `cod_returned_at` DATETIME(3) NULL,
    `rider_id` VARCHAR(191) NULL,
    `pickup_photo_id` VARCHAR(191) NULL,
    `delivery_photo_id` VARCHAR(191) NULL,
    `accepted_at` DATETIME(3) NULL,
    `arrived_pickup_at` DATETIME(3) NULL,
    `picked_up_at` DATETIME(3) NULL,
    `arrived_dropoff_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(255) NULL,
    `failed_at` DATETIME(3) NULL,
    `fail_reason` VARCHAR(255) NULL,
    `rating` TINYINT NULL,
    `rating_comment` VARCHAR(500) NULL,
    `rated_at` DATETIME(3) NULL,
    `settlement_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `jobs_code_key`(`code`),
    INDEX `jobs_status_town_id_vehicle_type_created_at_idx`(`status`, `town_id`, `vehicle_type`, `created_at`),
    INDEX `jobs_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `jobs_rider_id_status_idx`(`rider_id`, `status`),
    INDEX `jobs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_events` (
    `id` VARCHAR(191) NOT NULL,
    `job_id` VARCHAR(191) NOT NULL,
    `status` ENUM('SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CANCELLED', 'FAILED') NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `note` VARCHAR(255) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_events_job_id_created_at_idx`(`job_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `link` VARCHAR(200) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(191) NOT NULL,
    `rider_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `note` VARCHAR(255) NULL,
    `recorded_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `settlements_rider_id_created_at_idx`(`rider_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `data` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `riders` ADD CONSTRAINT `riders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `riders` ADD CONSTRAINT `riders_town_id_fkey` FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `riders` ADD CONSTRAINT `riders_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_town_id_fkey` FOREIGN KEY (`town_id`) REFERENCES `towns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_rider_id_fkey` FOREIGN KEY (`rider_id`) REFERENCES `riders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_events` ADD CONSTRAINT `job_events_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_events` ADD CONSTRAINT `job_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_rider_id_fkey` FOREIGN KEY (`rider_id`) REFERENCES `riders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
