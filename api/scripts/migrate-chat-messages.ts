import { eq } from "drizzle-orm";
import db from "../app/config/db";
import { messageAttachments, messages } from "../app/config/schema";

async function migrateMessagesContent() {
  // Fetch all messages
  const allMessages = await db.query.messages.findMany();

  for (const message of allMessages) {
    try {
      // Skip if text is null
      if (!message.text) continue;

      // Try to parse the content as JSON
      let content;
      try {
        // The message.text is already a string representation of JSON
        // But content is ending up as a string again, so we need to parse it properly
        const parsedContent = JSON.parse(message.text);
        content =
          typeof parsedContent === "string"
            ? JSON.parse(parsedContent)
            : parsedContent;
      } catch (e) {
        console.log(`Message ${message.id} is not JSON`);
        // If it's not JSON, it's already a plain text message
        continue;
      }

      // Skip if not a valid content object
      if (!content.type) continue;

      console.log(`Processing message ${message.id} of type ${content.type}`);

      switch (content.type) {
        case "text":
          // Update message with just the text content
          await db
            .update(messages)
            .set({ text: content.text })
            .where(eq(messages.id, message.id));
          console.log(`Updated text for message ${message.id}`);
          break;

        case "image":
        case "file":
          // First create attachment
          await db.insert(messageAttachments).values({
            messageId: message.id,
            type: content.type,
            fileKey: content.file_metadata.file_key,
            fileName: content.file_metadata.filename,
            mimeType: content.file_metadata.mime_type,
          });

          // Then update the message with an empty string (to satisfy NOT NULL)
          await db
            .update(messages)
            .set({ text: "" })
            .where(eq(messages.id, message.id));

          console.log(
            `Created ${content.type} attachment for message ${message.id}`
          );
          break;
      }
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      continue;
    }
  }

  console.log("Migration completed");
}

// Run the migration
migrateMessagesContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
