<?php
/* ---------------------------------------------------------
 |  Form Builder - configuration
 |  Edit these values when you move to cPanel hosting.
 * --------------------------------------------------------- */
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'formbuilder');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Base URL of the app (no trailing slash). Leave empty to auto-detect.
define('BASE_URL', '');

// Uploads directory (for file-type questions)
define('UPLOAD_DIR', dirname(__DIR__) . '/uploads');

date_default_timezone_set('Asia/Kolkata');
