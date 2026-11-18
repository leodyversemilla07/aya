ALTER TABLE "Conversation" ADD COLUMN "accessSubject" TEXT;

CREATE INDEX "Conversation_accessSubject_idx" ON "Conversation"("accessSubject");
