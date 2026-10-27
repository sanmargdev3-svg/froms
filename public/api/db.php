<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            json_out(['ok' => false, 'error' => 'Database connection failed: ' . $e->getMessage()
                . '. Run api/install.php first, or check api/config.php.'], 500);
        }
    }
    return $pdo;
}

function base_url(): string {
    if (BASE_URL !== '') return rtrim(BASE_URL, '/');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // scripts live in /api, the app root is one level up
    $dir    = rtrim(strtr(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '\\', '/'), '/');
    return $scheme . '://' . $host . $dir;
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function uuid(): string {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

function short_slug(int $len = 8): string {
    $a = 'abcdefghjkmnpqrstuvwxyz23456789';
    $s = '';
    for ($i = 0; $i < $len; $i++) $s .= $a[random_int(0, strlen($a) - 1)];
    return $s;
}

/* ---- session + CSRF ---- */
function start_session(): void {
    if (session_status() === PHP_SESSION_NONE && !headers_sent()) session_start();
}
function csrf_token(): string {
    start_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function check_csrf(?string $t): bool {
    start_session();
    return !empty($_SESSION['csrf']) && is_string($t) && hash_equals($_SESSION['csrf'], $t);
}

// start the session up-front so CSRF tokens work on every page
start_session();

/* -------------------------------------------------------------------
 |  Form appearance settings.
 |  Everything lives in forms.settings_json, so the table never changes.
 * ------------------------------------------------------------------- */
function default_settings(): array {
    return [
        'layout'      => 'paged',      // paged | single | typeform
        'primary'     => '#6366f1',
        'secondary'   => '#8b5cf6',
        'surface'     => 'light',      // light | dark
        'corner'      => 'round',      // round | soft | sharp
        'animate'     => true,
        'progress'    => true,
        'coverImage'  => '',
        'coverStyle'  => 'banner',     // none | banner | cover | logo
        'footerImage' => '',
        'submitLabel' => 'Submit',
        'endTitle'    => '',
        'endMessage'  => '',
        'endImage'    => '',
        'endBtnLabel' => '',
        'endBtnUrl'   => '',
        'endAgain'    => true,
        'endConfetti' => true,
    ];
}

/** A #rrggbb colour, or the fallback when the input is not one. */
function clean_hex($v, string $fallback): string {
    $v = trim((string)$v);
    if (preg_match('/^#[0-9a-fA-F]{3}$/', $v)) {           // #abc -> #aabbcc
        return '#' . $v[1] . $v[1] . $v[2] . $v[2] . $v[3] . $v[3];
    }
    return preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtolower($v) : $fallback;
}

/** An image reference we are willing to print into an <img src>. */
function clean_media($v): string {
    $v = trim((string)$v);
    if ($v === '') return '';
    if (preg_match('#^uploads/[A-Za-z0-9._-]{1,120}$#', $v)) return $v;
    if (preg_match('#^https?://[^\s"\'<>]{4,500}$#i', $v))   return $v;
    return '';
}

/** Absolute URL for a stored image reference. */
function media_url(string $v): string {
    if ($v === '') return '';
    return preg_match('#^https?://#i', $v) ? $v : base_url() . '/' . ltrim($v, '/');
}

/** Force whatever the builder sent into the shape above. */
function clean_settings(array $in): array {
    $d = default_settings();
    $enum = fn($k, array $ok) => in_array($in[$k] ?? '', $ok, true) ? $in[$k] : $d[$k];
    $bool = fn($k) => array_key_exists($k, $in) ? (bool)$in[$k] : $d[$k];
    $text = fn($k, $len) => mb_substr(trim((string)($in[$k] ?? $d[$k])), 0, $len);

    return [
        'layout'      => $enum('layout',     ['paged', 'single', 'typeform']),
        'primary'     => clean_hex($in['primary']   ?? '', $d['primary']),
        'secondary'   => clean_hex($in['secondary'] ?? '', $d['secondary']),
        'surface'     => $enum('surface',    ['light', 'dark']),
        'corner'      => $enum('corner',     ['round', 'soft', 'sharp']),
        'animate'     => $bool('animate'),
        'progress'    => $bool('progress'),
        'coverImage'  => clean_media($in['coverImage']  ?? ''),
        'coverStyle'  => $enum('coverStyle', ['none', 'banner', 'cover', 'logo']),
        'footerImage' => clean_media($in['footerImage'] ?? ''),
        'submitLabel' => $text('submitLabel', 40) ?: 'Submit',
        'endTitle'    => $text('endTitle',   160),
        'endMessage'  => $text('endMessage', 1000),
        'endImage'    => clean_media($in['endImage'] ?? ''),
        'endBtnLabel' => $text('endBtnLabel', 40),
        'endBtnUrl'   => preg_match('#^https?://[^\s"\'<>]{4,500}$#i', trim((string)($in['endBtnUrl'] ?? ''))) ? trim($in['endBtnUrl']) : '',
        'endAgain'    => $bool('endAgain'),
        'endConfetti' => $bool('endConfetti'),
    ];
}

/** Settings for a form row, with every default filled in.
 *  A form saved before the design panel existed keeps the accent colour it
 *  had picked in the old `theme` column. */
function form_settings(?string $json, ?string $theme = null): array {
    $raw = json_decode((string)$json, true) ?: [];
    if (!isset($raw['primary']) && $theme) {
        $legacy = [
            'indigo'  => ['#6366f1', '#8b5cf6'], 'violet' => ['#8b5cf6', '#a855f7'],
            'sky'     => ['#0ea5e9', '#2563eb'], 'emerald'=> ['#10b981', '#0d9488'],
            'amber'   => ['#f59e0b', '#f43f5e'], 'rose'   => ['#f43f5e', '#fb923c'],
            'slate'   => ['#0f172a', '#475569'],
        ];
        if (isset($legacy[$theme])) {
            $raw['primary']   = $legacy[$theme][0];
            $raw['secondary'] = $legacy[$theme][1];
        }
    }
    return clean_settings($raw);
}
