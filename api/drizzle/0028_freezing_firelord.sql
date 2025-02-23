-- 1) This ensures we only insert a processing job for documents that actually have a file_key.
-- 2) We exclude documents that may already have a job using a LEFT JOIN filter.

INSERT INTO "document_processing_jobs" ("document_id", "file_key", "file_name", "mime_type", "status")
SELECT d.id, d.file_key, d.name, d.mime_type, 'pending'
FROM "documents" d
LEFT JOIN "document_processing_jobs" dpj ON dpj.document_id = d.id
WHERE d.file_key IS NOT NULL
  AND d.type = 'file'
  AND dpj.document_id IS NULL
  AND (
    LOWER(SUBSTRING(d.name FROM '\.([^\.]+)$')) IN (
      'abw', 'bmp', 'csv', 'cwk', 'dbf', 'dif', 'doc', 'docm', 'docx',
      'dot', 'dotm', 'eml', 'epub', 'et', 'eth', 'fods', 'gif', 'heic',
      'htm', 'html', 'hwp', 'jpeg', 'jpg', 'md', 'mcw', 'mw', 'odt',
      'org', 'p7s', 'pages', 'pbd', 'pdf', 'png', 'pot', 'potm', 'ppt',
      'pptm', 'pptx', 'prn', 'rst', 'rtf', 'sdp', 'sgl', 'svg', 'sxg',
      'tiff', 'txt', 'tsv', 'uof', 'uos1', 'uos2', 'web', 'webp', 'wk2',
      'xls', 'xlsb', 'xlsm', 'xlsx', 'xlw', 'xml', 'zabw'
    )
  );