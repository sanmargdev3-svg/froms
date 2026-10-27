<?php
/* JSON API for the React app. Every screen talks to this one file:
   api/index.php?action=<name>. The table structure never changes -
   questions live in forms.schema_json, answers in responses.data_json. */
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/** JSON request body (empty array for multipart / GET). */
function body(): array {
    static $in = null;
    if ($in === null) $in = json_decode(file_get_contents('php://input'), true) ?: [];
    return $in;
}

/** Admin writes must carry the session token, in a header or a POST field. */
function require_csrf(): void {
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['csrf'] ?? (body()['csrf'] ?? null));
    if (!check_csrf($t)) json_out(['ok' => false, 'error' => 'Session expired, reload the page.'], 403);
}

function require_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['ok' => false, 'error' => 'Use POST.'], 405);
}

function find_form(int $id): array {
    $st = db()->prepare('SELECT * FROM forms WHERE id = ?');
    $st->execute([$id]);
    $form = $st->fetch();
    if (!$form) json_out(['ok' => false, 'error' => 'Form not found.'], 404);
    return $form;
}

function schema_of(array $form): array {
    return json_decode($form['schema_json'], true) ?: [];
}

function questions_of(array $form): array {
    return array_values(array_filter(schema_of($form), fn($f) => ($f['type'] ?? '') !== 'section'));
}

try {
switch ($action) {

/* ---------------------------------------------------------------- csrf */
case 'csrf':
    json_out(['ok' => true, 'token' => csrf_token()]);

/* ---------------------------------------------------- dashboard list */
case 'forms':
    $q = trim($_GET['q'] ?? '');
    $sql = "SELECT f.*, (SELECT COUNT(*) FROM responses r WHERE r.form_id = f.id) AS response_count FROM forms f";
    $args = [];
    if ($q !== '') { $sql .= ' WHERE f.title LIKE ?'; $args[] = '%' . $q . '%'; }
    $sql .= ' ORDER BY f.updated_at DESC';
    $st = db()->prepare($sql); $st->execute($args);

    $forms = [];
    foreach ($st->fetchAll() as $f) {
        $S = form_settings($f['settings_json'] ?? null, $f['theme'] ?? null);
        $forms[] = [
            'id'          => (int)$f['id'],
            'slug'        => $f['slug'],
            'title'       => $f['title'],
            'description' => (string)$f['description'],
            'status'      => $f['status'],
            'views'       => (int)$f['views'],
            'responses'   => (int)$f['response_count'],
            'questions'   => count(questions_of($f)),
            'accent'      => $S['primary'],
            'updated_at'  => $f['updated_at'],
        ];
    }
    $stats = db()->query("SELECT
        (SELECT COUNT(*) FROM forms) AS forms,
        (SELECT COUNT(*) FROM forms WHERE status='published') AS live,
        (SELECT COUNT(*) FROM responses) AS responses,
        (SELECT COALESCE(SUM(views),0) FROM forms) AS views")->fetch();
    json_out(['ok' => true, 'forms' => $forms, 'stats' => array_map('intval', $stats)]);

/* ------------------------------------------------- one form, for edit */
case 'form':
    $form = find_form((int)($_GET['id'] ?? 0));
    $count = db()->prepare('SELECT COUNT(*) FROM responses WHERE form_id = ?');
    $count->execute([$form['id']]);
    json_out(['ok' => true, 'form' => [
        'id'          => (int)$form['id'],
        'title'       => $form['title'],
        'description' => (string)$form['description'],
        'status'      => $form['status'],
        'theme'       => $form['theme'],
        'slug'        => $form['slug'],
        'fields'      => schema_of($form),
        'settings'    => form_settings($form['settings_json'] ?? null, $form['theme'] ?? null),
    ], 'responseCount' => (int)$count->fetchColumn()]);

/* ------------------------------------------------------- save schema */
case 'save':
    require_post(); require_csrf();
    $in = body();

    $allowed = ['text','textarea','email','phone','number','date','time','select','radio','checkbox','rating','file','audio','section'];
    $fields  = [];
    foreach ((array)($in['fields'] ?? []) as $f) {
        $type = in_array($f['type'] ?? '', $allowed, true) ? $f['type'] : 'text';
        $row = [
            'key'         => preg_replace('/[^a-zA-Z0-9_]/', '', (string)($f['key'] ?? '')) ?: uniqid('f_'),
            'type'        => $type,
            'label'       => mb_substr(trim((string)($f['label'] ?? '')), 0, 500),
            'help'        => mb_substr(trim((string)($f['help'] ?? '')), 0, 500),
            'placeholder' => mb_substr(trim((string)($f['placeholder'] ?? '')), 0, 200),
            'required'    => !empty($f['required']) && $type !== 'section',
        ];
        if (in_array($type, ['select','radio','checkbox'], true)) {
            $opts = array_values(array_filter(array_map(
                fn($o) => mb_substr(trim((string)$o), 0, 200), (array)($f['options'] ?? [])
            ), fn($o) => $o !== ''));
            $row['options'] = $opts ?: ['Option 1'];
            // answer key for quiz questions - never sent to respondents
            if ($type !== 'checkbox' && isset($f['correct']) && in_array((string)$f['correct'], $row['options'], true)) {
                $row['correct'] = (string)$f['correct'];
            }
        }
        if ($type === 'audio') $row['passage'] = mb_substr(trim((string)($f['passage'] ?? '')), 0, 5000);
        if ($type === 'rating') $row['max'] = max(3, min(10, (int)($f['max'] ?? 5)));
        if ($type === 'section') {
            $lvl = (int)($f['level'] ?? 2);
            $row['level']   = in_array($lvl, [2, 3, 4], true) ? $lvl : 2;
            $row['newpage'] = !empty($f['newpage']);
        }
        $fields[] = $row;
    }

    $title  = mb_substr(trim((string)($in['title'] ?? '')), 0, 255) ?: 'Untitled form';
    $desc   = mb_substr(trim((string)($in['description'] ?? '')), 0, 2000);
    $status = in_array($in['status'] ?? '', ['draft','published','closed'], true) ? $in['status'] : 'draft';
    $themes = ['indigo','violet','sky','emerald','amber','rose','slate'];
    $theme  = in_array($in['theme'] ?? '', $themes, true) ? $in['theme'] : 'indigo';
    $schema = json_encode($fields, JSON_UNESCAPED_UNICODE);
    $settings = json_encode(clean_settings((array)($in['settings'] ?? [])), JSON_UNESCAPED_UNICODE);

    $id = (int)($in['id'] ?? 0);
    if ($id > 0) {
        $st = db()->prepare('UPDATE forms SET title=?, description=?, schema_json=?, settings_json=?, theme=?, status=? WHERE id=?');
        $st->execute([$title, $desc, $schema, $settings, $theme, $status, $id]);
        $slug = db()->query('SELECT slug FROM forms WHERE id=' . $id)->fetchColumn();
        if ($slug === false) json_out(['ok' => false, 'error' => 'Form no longer exists.'], 404);
    } else {
        do {
            $slug = short_slug();
            $exists = db()->prepare('SELECT 1 FROM forms WHERE slug=?');
            $exists->execute([$slug]);
        } while ($exists->fetchColumn());

        $st = db()->prepare('INSERT INTO forms (uuid, slug, title, description, schema_json, settings_json, theme, status)
                             VALUES (?,?,?,?,?,?,?,?)');
        $st->execute([uuid(), $slug, $title, $desc, $schema, $settings, $theme, $status]);
        $id = (int)db()->lastInsertId();
    }
    json_out(['ok' => true, 'id' => $id, 'slug' => $slug, 'fields' => count($fields)]);

/* ------------------------------------------ design graphic upload */
case 'upload':
    require_post(); require_csrf();
    $file = $_FILES['file'] ?? null;
    if (!$file || ($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
        json_out(['ok' => false, 'error' => 'Nothing was uploaded (or the file is too large).'], 400);
    }
    if ($file['size'] > 4 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Keep images under 4 MB.'], 400);

    $mime = function_exists('finfo_open')
        ? finfo_file(finfo_open(FILEINFO_MIME_TYPE), $file['tmp_name'])
        : mime_content_type($file['tmp_name']);
    $ok = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp',
           'image/gif' => 'gif', 'image/svg+xml' => 'svg'];
    if (!isset($ok[$mime])) json_out(['ok' => false, 'error' => 'Use a PNG, JPG, WEBP, GIF or SVG image.'], 400);

    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0775, true);
    $name = 'img_' . date('Ymd_His') . '_' . short_slug(6) . '.' . $ok[$mime];
    if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $name)) {
        json_out(['ok' => false, 'error' => 'Could not store the image.'], 500);
    }
    json_out(['ok' => true, 'path' => 'uploads/' . $name]);

/* ------------------------------------------------------ delete form */
case 'delete_form':
    require_post(); require_csrf();
    // responses go with it through the ON DELETE CASCADE foreign key
    db()->prepare('DELETE FROM forms WHERE id = ?')->execute([(int)(body()['id'] ?? 0)]);
    json_out(['ok' => true]);

/* -------------------------------------------------- delete response */
case 'delete_response':
    require_post(); require_csrf();
    $in = body();
    db()->prepare('DELETE FROM responses WHERE id = ? AND form_id = ?')
        ->execute([(int)($in['response'] ?? 0), (int)($in['id'] ?? 0)]);
    json_out(['ok' => true]);

/* ---------------------------------------------------- response table */
case 'responses':
    $form    = find_form((int)($_GET['id'] ?? 0));
    $id      = (int)$form['id'];
    $perPage = 25;
    $total   = (int)db()->query('SELECT COUNT(*) FROM responses WHERE form_id = ' . $id)->fetchColumn();
    $pages   = max(1, (int)ceil($total / $perPage));
    $page    = min(max(1, (int)($_GET['page'] ?? 1)), $pages);

    $rs = db()->prepare('SELECT id, data_json, created_at FROM responses WHERE form_id = ? ORDER BY id DESC LIMIT ? OFFSET ?');
    $rs->bindValue(1, $id, PDO::PARAM_INT);
    $rs->bindValue(2, $perPage, PDO::PARAM_INT);
    $rs->bindValue(3, ($page - 1) * $perPage, PDO::PARAM_INT);
    $rs->execute();
    $rows = array_map(fn($r) => [
        'id'         => (int)$r['id'],
        'created_at' => $r['created_at'],
        'data'       => json_decode($r['data_json'], true) ?: new stdClass(),
    ], $rs->fetchAll());

    json_out(['ok' => true,
        'form'   => ['id' => $id, 'title' => $form['title'], 'slug' => $form['slug'], 'views' => (int)$form['views']],
        'fields' => questions_of($form),
        'rows'   => $rows, 'total' => $total, 'page' => $page, 'pages' => $pages]);

/* ------------------------------------- scored results, every row */
case 'results':
    $form = find_form((int)($_GET['id'] ?? 0));
    $rs = db()->prepare('SELECT id, data_json, created_at FROM responses WHERE form_id = ? ORDER BY id DESC');
    $rs->execute([$form['id']]);
    $rows = array_map(fn($r) => [
        'id'         => (int)$r['id'],
        'created_at' => $r['created_at'],
        'data'       => json_decode($r['data_json'], true) ?: new stdClass(),
    ], $rs->fetchAll());
    json_out(['ok' => true,
        'form'   => ['id' => (int)$form['id'], 'title' => $form['title'], 'slug' => $form['slug'],
                     'views' => (int)$form['views']],
        'fields' => schema_of($form),
        'rows'   => $rows]);

/* ------------------------------------------------------- CSV export */
case 'export':
    $form   = find_form((int)($_GET['id'] ?? 0));
    $fields = questions_of($form);

    $file = preg_replace('/[^a-zA-Z0-9]+/', '-', $form['title']) . '-' . date('Ymd-Hi') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $file . '"');

    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel reads UTF-8

    $head = ['#', 'Submitted at'];
    foreach ($fields as $f) $head[] = $f['label'] ?: $f['key'];
    fputcsv($out, $head);

    $rs = db()->prepare('SELECT * FROM responses WHERE form_id = ? ORDER BY id ASC');
    $rs->execute([$form['id']]);
    while ($r = $rs->fetch()) {
        $data = json_decode($r['data_json'], true) ?: [];
        $line = [$r['id'], $r['created_at']];
        foreach ($fields as $f) {
            $a = $data[$f['key']] ?? null;
            if (!$a)          { $line[] = ''; continue; }
            $v = $a['value'] ?? '';
            if (is_array($v)) { $line[] = implode(' | ', $v); continue; }
            if (in_array($a['type'] ?? '', ['file', 'audio'], true) && $v !== '') {
                $line[] = base_url() . '/uploads/' . $v;
                continue;
            }
            $line[] = (string)$v;
        }
        fputcsv($out, $line);
    }
    fclose($out);
    exit;

/* ------------------------------------------ public: load a form */
case 'public':
    $slug    = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['slug'] ?? '');
    $preview = !empty($_GET['preview']);
    $st = db()->prepare('SELECT * FROM forms WHERE slug = ?');
    $st->execute([$slug]);
    $form = $st->fetch();
    if (!$form) json_out(['ok' => false, 'state' => 'missing'], 404);
    if (!$preview && $form['status'] !== 'published') {
        json_out(['ok' => false, 'state' => $form['status'], 'title' => $form['title']]);
    }
    if (!$preview && !empty($_GET['count'])) {
        db()->prepare('UPDATE forms SET views = views + 1 WHERE id = ?')->execute([$form['id']]);
    }
    $public = array_map(function ($f) { unset($f['correct']); return $f; }, schema_of($form));
    json_out(['ok' => true, 'form' => [
        'slug'        => $form['slug'],
        'title'       => $form['title'],
        'description' => (string)$form['description'],
        'fields'      => $public,
        'settings'    => form_settings($form['settings_json'] ?? null, $form['theme'] ?? null),
    ]]);

/* --------------------------------------- public: submit answers */
case 'submit':
    require_post();
    $slug    = preg_replace('/[^a-zA-Z0-9]/', '', $_POST['slug'] ?? '');
    $preview = !empty($_POST['preview']);
    $st = db()->prepare('SELECT * FROM forms WHERE slug = ?');
    $st->execute([$slug]);
    $form = $st->fetch();
    if (!$form) json_out(['ok' => false, 'error' => 'Form not found.'], 404);
    if (!$preview && $form['status'] !== 'published') {
        json_out(['ok' => false, 'error' => 'This form is not accepting responses.'], 403);
    }

    $posted  = json_decode((string)($_POST['data'] ?? ''), true) ?: [];
    $auto    = !empty($_POST['auto']);   // the time limit ran out: keep whatever was answered
    $answers = $errors = [];
    foreach (questions_of($form) as $f) {
        $key   = $f['key'];
        $label = $f['label'] ?: $key;

        if ($f['type'] === 'file' || $f['type'] === 'audio') {
            $up = $_FILES['file_' . $key] ?? null;
            if (!$up || ($up['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                $answers[$key] = ['label' => $label, 'type' => $f['type'], 'value' => ''];
                if (!empty($f['required'])) $errors[$key] = 'This question is required.';
                continue;
            }
            if ($up['error'] !== UPLOAD_ERR_OK) { $errors[$key] = 'Upload failed, try a smaller file.'; continue; }
            if ($preview) {   // nothing is stored in preview mode
                $answers[$key] = ['label' => $label, 'type' => $f['type'], 'value' => '', 'original' => $up['name']];
                continue;
            }
            $ext  = preg_replace('/[^a-z0-9]/', '', strtolower(pathinfo($up['name'], PATHINFO_EXTENSION)));
            if (in_array($ext, ['php', 'phtml', 'phar', 'htaccess'], true)) $ext = 'txt';
            $name = date('Ymd_His') . '_' . short_slug(6) . ($ext ? '.' . $ext : '');
            if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0775, true);
            if (!move_uploaded_file($up['tmp_name'], UPLOAD_DIR . '/' . $name)) {
                $errors[$key] = 'Could not store the file.';
                continue;
            }
            $answers[$key] = ['label' => $label, 'type' => $f['type'], 'value' => $name,
                              'original' => mb_substr($up['name'], 0, 255)];
            continue;
        }

        $val = $posted[$key] ?? ($f['type'] === 'checkbox' ? [] : '');
        if ($f['type'] === 'checkbox') {
            $val   = array_values(array_map(fn($v) => mb_substr(trim((string)$v), 0, 2000), (array)$val));
            $empty = count($val) === 0;
        } else {
            $val   = is_array($val) ? '' : mb_substr(trim((string)$val), 0, 5000);
            $empty = $val === '';
        }
        $answers[$key] = ['label' => $label, 'type' => $f['type'], 'value' => $val];
        if (isset($f['correct'])) $answers[$key]['correct'] = !$empty && $val === $f['correct'];

        if ($auto) continue;
        if (!empty($f['required']) && $empty) {
            $errors[$key] = 'This question is required.';
        } elseif (!$empty && $f['type'] === 'email' && !filter_var($val, FILTER_VALIDATE_EMAIL)) {
            $errors[$key] = 'Enter a valid email address.';
        } elseif (!$empty && $f['type'] === 'number' && !is_numeric($val)) {
            $errors[$key] = 'Enter a number.';
        } elseif (!$empty && $f['type'] === 'phone' && !preg_match('/^[0-9 +()\-]{6,20}$/', $val)) {
            $errors[$key] = 'Enter a valid phone number.';
        }
    }

    if ($auto) $errors = array_filter($errors, fn($m) => $m !== 'This question is required.');
    if ($errors) json_out(['ok' => false, 'errors' => $errors], 422);

    $answers['_meta'] = ['auto' => $auto, 'elapsed' => max(0, (int)($_POST['elapsed'] ?? 0))];

    if (!$preview) {
        db()->prepare('INSERT INTO responses (form_id, data_json, ip, user_agent) VALUES (?,?,?,?)')
            ->execute([
                $form['id'],
                json_encode($answers, JSON_UNESCAPED_UNICODE),
                $_SERVER['REMOTE_ADDR'] ?? null,
                mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            ]);
    }
    json_out(['ok' => true]);

default:
    json_out(['ok' => false, 'error' => 'Unknown action.'], 400);
}
} catch (Throwable $ex) {
    json_out(['ok' => false, 'error' => 'Server error: ' . $ex->getMessage()], 500);
}
