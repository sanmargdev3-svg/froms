<?php
/* Old share links (f.php?f=slug) keep working: hand them to the React route. */
$slug = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['f'] ?? '');
header('Location: ./#/f/' . $slug . (!empty($_GET['preview']) ? '?preview=1' : ''), true, 301);
