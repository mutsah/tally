/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `reset_password` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "reset_password_token_key" ON "reset_password"("token");
