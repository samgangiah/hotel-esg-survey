-- Post-sign-in destination carried through the /recover flow when it
-- originated from a deep link. Validated same-origin path; null for
-- ordinary invitations.
ALTER TABLE "Invitation" ADD COLUMN "nextPath" TEXT;
