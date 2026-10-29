CREATE TABLE "UserActivityDay" (
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("userId", "day"),
  CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");
