<?php
/* One-time installer: creates the database and the two fixed tables.
   Safe to re-run - it never drops or alters existing data. */
require_once __DIR__ . '/config.php';

$log = [];
try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET, DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $log[] = 'Database `' . DB_NAME . '` ready.';
    $pdo->exec('USE `' . DB_NAME . '`');

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS forms (
        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        uuid          CHAR(36)        NOT NULL,
        slug          VARCHAR(32)     NOT NULL,
        title         VARCHAR(255)    NOT NULL DEFAULT 'Untitled form',
        description   TEXT            NULL,
        schema_json   LONGTEXT        NOT NULL,
        settings_json LONGTEXT        NULL,
        theme         VARCHAR(32)     NOT NULL DEFAULT 'indigo',
        status        ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
        views         INT UNSIGNED    NOT NULL DEFAULT 0,
        created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_forms_uuid (uuid),
        UNIQUE KEY uq_forms_slug (slug),
        KEY idx_forms_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $log[] = 'Table `forms` ready.';

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS responses (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        form_id      BIGINT UNSIGNED NOT NULL,
        data_json    LONGTEXT        NOT NULL,
        ip           VARCHAR(45)     NULL,
        user_agent   VARCHAR(255)    NULL,
        created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_resp_form (form_id, id),
        CONSTRAINT fk_resp_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $log[] = 'Table `responses` ready.';

    if (!is_dir(UPLOAD_DIR)) { @mkdir(UPLOAD_DIR, 0775, true); }
    $log[] = is_dir(UPLOAD_DIR) ? 'Uploads folder ready.' : 'Could not create uploads folder (file questions will fail).';
    $ok = true;
} catch (Throwable $ex) {
    $ok = false;
    $err = $ex->getMessage();
}
?>
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install &middot; Form Builder</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-6">
<div class="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
  <h1 class="text-2xl font-bold text-slate-800 mb-1">Form Builder installer</h1>
  <p class="text-slate-500 text-sm mb-6">Creates the two fixed tables. Your form fields live in JSON, so these columns never change again.</p>
  <?php if ($ok): ?>
    <ul class="space-y-2 mb-6">
      <?php foreach ($log as $l): ?>
        <li class="flex gap-2 text-sm text-slate-700"><span class="text-emerald-500">&#10004;</span><?= htmlspecialchars($l) ?></li>
      <?php endforeach; ?>
    </ul>
    <a href="../" class="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg">Open dashboard &rarr;</a>
    <p class="text-xs text-slate-400 mt-4">Delete <code>install.php</code> once you are live.</p>
  <?php else: ?>
    <div class="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-4">
      <strong>Install failed:</strong><br><?= htmlspecialchars($err) ?>
    </div>
  <?php endif; ?>
</div>
</body></html>
