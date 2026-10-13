-- Why a delivery failed, from the rider's fixed list (fail_code), whether it
-- was the buyer's fault (buyer_fault), and whether the rider is paid for the
-- failed trip (fail_paid: an E-MOORM job that failed by the buyer's fault,
-- set once the parcel is back; it then counts like a delivered job in the
-- rider's earnings, commission and settlements).

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `fail_code` VARCHAR(20) NULL,
    ADD COLUMN `buyer_fault` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `fail_paid` BOOLEAN NOT NULL DEFAULT false;
