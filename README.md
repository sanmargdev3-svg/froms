# FormCraft — React form builder

A Google-Forms style builder: design a form in the browser, publish it, share one
link, and collect answers. The frontend is **React (Vite + Tailwind)**; a small
**PHP + MySQL JSON API** stores the data. The database schema never changes when you
add fields: questions live in `forms.schema_json`, answers in `responses.data_json`.

## Project layout

```
src/                     React app
  pages/Dashboard.jsx      all forms, stats, share links
  pages/Builder.jsx        editor: questions, drag to reorder, status, autosave
  pages/Responses.jsx      response table, pagination, delete, CSV export
  pages/PublicForm.jsx     public form: paged / single / conversational layouts
  components/              QuestionCard, DesignModal, Modal, Switch, …
  lib/api.js               API client (CSRF handled for you)
public/                  copied as-is into dist/ on build
  api/index.php            JSON API (all actions)
  api/db.php, config.php   PDO connection, settings helpers, credentials
  api/install.php          one-time table creation
  uploads/                 uploaded files (PHP execution disabled)
  f.php                    redirects old f.php?f=slug links to the React route
```

## Develop locally (XAMPP)

1. Project at `D:\xaamp\htdocs\form`. Start Apache + MySQL.
2. `cp public/api/config.example.php public/api/config.php` and set the DB credentials.
3. Open <http://localhost/form/public/api/install.php> once to create the tables.
4. `npm install` then `npm run dev` and open the URL Vite prints.
   Vite proxies `/api` and `/uploads` to `http://localhost/form/public`
   (override with the `PHP_ORIGIN` / `PHP_PATH` env vars).

## Deploy on Vercel

On Vercel the PHP folder is not used. The API is the Node function `api/app.js`
(same actions as the PHP one), data lives in **Neon Postgres** and uploaded images and
voice recordings in **Vercel Blob**. Builds detect Vercel automatically.

1. Import the GitHub repo in Vercel (framework: Vite, defaults are fine).
2. Project → **Storage** → **Create Database** → **Neon (Postgres)** → connect it to the
   project. This adds `DATABASE_URL`. Tables are created on the first request.
3. Project → **Storage** → **Create** → **Blob** → connect it. This adds
   `BLOB_READ_WRITE_TOKEN`.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables are picked up.

Request bodies are capped at 4.5 MB on Vercel, so recordings are captured at 32 kbps
and uploads are limited to 4 MB each.

## Build and deploy (cPanel or any PHP host)

1. `npm run build` — produces `dist/` containing the React app **and** the PHP API.
2. Upload the contents of `dist/` to e.g. `public_html/form/`.
3. Create a MySQL database + user in cPanel, put the credentials in `api/config.php`.
4. Visit `https://yourdomain.com/form/api/install.php` once, then delete that file.
5. Make sure `uploads/` is writable.

Routes use the hash router, so no rewrite rules are needed:

| URL | Screen |
|---|---|
| `/#/` | Dashboard |
| `/#/builder/:id` | Builder |
| `/#/responses/:id` | Responses |
| `/#/f/:slug` | Public form (`?preview=1` renders without saving) |

## Question types

Short answer, paragraph, email, phone, number, date, time, dropdown, multiple
choice, checkboxes, star rating, file upload, section heading (optionally starting a
new page). Each supports helper text, a placeholder and a required flag. Answers are
validated in the browser and again on the server.

## Data model (fixed forever)

```
forms      id, uuid, slug, title, description, schema_json, settings_json,
           theme, status, views, created_at, updated_at
responses  id, form_id, data_json, ip, user_agent, created_at
```

## Notes

- Forms accept answers only while `status = published`.
- There is no login: anyone who can open the dashboard can edit forms and read
  responses. On a public domain, protect the folder with cPanel's **Directory
  Privacy** and leave `index.html`, `assets/` and `api/` reachable for respondents
  (or put the admin behind a separate protected copy).
