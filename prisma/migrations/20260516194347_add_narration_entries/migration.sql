-- CreateTable
CREATE TABLE "NarrationEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instruction" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NarrationEntry_instruction_key" ON "NarrationEntry"("instruction");
