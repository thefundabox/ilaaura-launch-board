# ILAAURA Launch Board

A shared launch-readiness checklist for the ILAAURA Diwali 2026 launch. It's a static page (GitHub Pages) backed by [Supabase](https://supabase.com) for storage, sign-in and live updates, so changes one person makes show up for the other straight away.

With `config.js` left empty, the board runs in **local mode** and saves to the browser only, which is handy for trying it out.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page layout and styles |
| `app.js` | Board logic, rendering, sign-in |
| `store.js` | Storage: Supabase (shared) or localStorage (local mode) |
| `config.js` | Your Supabase URL and anon key |
| `supabase/schema.sql` | Tables, access rules and live-update setup |
| `private/seed.sql` | The 60 existing tasks. **Git-ignored**, so your plans stay out of the public repo |

## Setup

### 1. Create the Supabase project
1. Sign up at supabase.com and create a new project (free tier is enough).
2. Open **SQL Editor → New query**, paste in `supabase/schema.sql` and run it.
3. Still in the SQL editor, add the people allowed on the board:
   ```sql
   insert into public.board_members (email) values
     ('aamir@example.com'),
     ('shamika@example.com');
   ```
4. Load the existing tasks: paste in `private/seed.sql` and run it.

### 2. Connect the page
1. In Supabase, go to **Project Settings → API** and copy the **Project URL** and the **anon public** key into `config.js`.
   The anon key is meant to be public. Row-level security in `schema.sql` means only emails listed in `board_members` can read or change tasks.
2. Go to **Authentication → URL Configuration** and set **Site URL** to your GitHub Pages address (e.g. `https://<your-user>.github.io/ilaaura-launch-board/`). Also add it under **Redirect URLs**, along with `http://localhost:8000/` if you'll test locally.

### 3. Publish on GitHub Pages
1. Create an empty public repo on github.com named `ilaaura-launch-board`.
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<your-user>/ilaaura-launch-board.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**, set Source to **Deploy from a branch**, then pick `main` and `/ (root)`.
4. After a minute the board is live at `https://<your-user>.github.io/ilaaura-launch-board/`.

## Signing in
Enter your email and click the link Supabase sends you. Emails that aren't in `board_members` can sign in but see a "not on this board" message and can't read or change anything.

Supabase's built-in email sender has a low hourly limit. That's fine for two people; for more, set up custom SMTP under **Authentication → Emails**.

## Running locally
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000.

## Changing milestones or areas
Launch dates are in `MILES` and area names and colours are in `AREAS`, both at the top of `app.js`.
