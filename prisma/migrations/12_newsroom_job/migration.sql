CREATE TYPE "NewsroomRunStatus" AS ENUM ('RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED');

CREATE TABLE "NewsroomRun" (
    "date" TEXT NOT NULL,
    "status" "NewsroomRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    CONSTRAINT "NewsroomRun_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "NewsroomResearch" (
    "date" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "NewsroomResearch_pkey" PRIMARY KEY ("date", "topic"),
    CONSTRAINT "NewsroomResearch_date_fkey" FOREIGN KEY ("date") REFERENCES "NewsroomRun"("date") ON DELETE CASCADE ON UPDATE CASCADE
);
