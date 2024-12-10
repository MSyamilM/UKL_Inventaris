/*
  Warnings:

  - You are about to drop the column `description` on the `item` table. All the data in the column will be lost.
  - Added the required column `category` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `item` DROP COLUMN `description`,
    ADD COLUMN `category` VARCHAR(191) NOT NULL,
    ADD COLUMN `location` VARCHAR(191) NOT NULL;
