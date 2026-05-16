-- CreateTable
CREATE TABLE "MeditationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isPro" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "MeditationStep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "instruction" TEXT,
    "silenceDurationSeconds" INTEGER,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "MeditationStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeditationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
