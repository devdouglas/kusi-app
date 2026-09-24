-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Seed the initial account, exactly once. Migrations only ever run once per
-- database (tracked in _prisma_migrations), so this can never re-run and
-- overwrite a password that's since been changed via the Account page —
-- ON CONFLICT is only a defensive backstop, not the primary safeguard.
-- Password hash generated via src/lib/auth/password.ts (hashPassword);
-- the plaintext password was given directly to the account holder and is
-- deliberately not recorded anywhere in this repository.
INSERT INTO "User" (id, username, "passwordHash", "createdAt", "updatedAt")
VALUES (
  'cm0user0000000000000sarahv',
  'SarahV',
  '2a4599ef621ee16f820ca918c9c7096d:b7c00e3e40f519e4cc0b0812db9956516b6f5927bf85efb19e5706ccf424459f3b64aebb1db45931cf342630e60f8a372ddb97cc28ad4f8edcc6c3ee29b1d31e',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (username) DO NOTHING;
