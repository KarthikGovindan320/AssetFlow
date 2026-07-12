-- Last line of defense against double allocation: at most ONE active
-- (not-yet-returned) allocation may exist per asset, enforced by the database
-- itself regardless of application bugs or race conditions.
CREATE UNIQUE INDEX one_active_allocation_per_asset
  ON "Allocation" ("assetId")
  WHERE "returnedAt" IS NULL;

-- An allocation targets exactly one holder: a user XOR a department.
ALTER TABLE "Allocation"
  ADD CONSTRAINT allocation_exactly_one_holder CHECK (
    ("allocatedToUserId" IS NOT NULL AND "allocatedToDepartmentId" IS NULL) OR
    ("allocatedToUserId" IS NULL AND "allocatedToDepartmentId" IS NOT NULL)
  );

-- A transfer request likewise targets exactly one recipient.
ALTER TABLE "TransferRequest"
  ADD CONSTRAINT transfer_exactly_one_target CHECK (
    ("requestedForUserId" IS NOT NULL AND "requestedForDepartmentId" IS NULL) OR
    ("requestedForUserId" IS NULL AND "requestedForDepartmentId" IS NOT NULL)
  );
