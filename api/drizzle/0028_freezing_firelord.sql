-- 1) This ensures we only insert a processing job for documents that actually have a file_key.
-- 2) We exclude documents that may already have a job using a LEFT JOIN filter.

INSERT INTO "document_processing_jobs" ("document_id", "file_key", "file_name", "mime_type", "status")
SELECT d.id, d.file_key, d.name, d.mime_type, 'pending'
FROM "documents" d
LEFT JOIN "document_processing_jobs" dpj ON dpj.document_id = d.id
WHERE d.file_key IS NOT NULL
  AND d.type = 'file'
  AND dpj.document_id IS NULL;