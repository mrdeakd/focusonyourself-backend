-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dateString" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "feelingsDescription" TEXT,
    "sleepQuality" INTEGER,
    "stressLevel" INTEGER,
    "exercised" BOOLEAN,
    "socialQuality" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_userId_dateString_key" ON "CheckIn"("userId", "dateString");
