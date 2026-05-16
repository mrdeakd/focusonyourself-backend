-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "readTimeMinutes" INTEGER NOT NULL,
    "body" TEXT NOT NULL
);
