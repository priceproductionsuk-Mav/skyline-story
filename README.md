# [COMPANY NAME] website

A static, single-page site in plain HTML, CSS and JavaScript. There is no build step and nothing to install.

```
index.html            all page content
css/style.css         styles; brand colours and fonts are at the top in :root
js/network.js         the dots-and-lines animation (intro stage + process markers)
js/questionnaire.js   the step-by-step questionnaire
js/main.js            menu, nav fade-in, scroll reveals, packages carousel
.nojekyll             tells GitHub Pages to serve files as-is
```

## Preview locally

```
cd website
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Placeholders to fill in

| Placeholder | Where | Notes |
|---|---|---|
| `[COMPANY NAME]` | `index.html` (title, meta, menu, footer, form subject) | Find and replace all. |
| `[FORMSPREE_ENDPOINT]` | `index.html`, the `action` of both `#quote-form` and `#contact-form` | See "Questionnaire emails" below. The same endpoint works for both. |
| `[EMAIL]` | `index.html`, Contact section note | Appears twice (link text and `mailto:`). |
| Fonts | `css/style.css`, `--font` | Currently the system font (SF Pro on Apple devices). |

## Open decisions and how to change them

- **"Get a Quote" button outside the menu:** set `data-quote-button="on"` on `<body>` in `index.html`. It is currently `off`.
- **Budget framing line** ("Quality systems start from around £1,000."): marked `PROVISIONAL` in `index.html`. It appears once in each path; delete both `<p class="q-note">` lines to remove it.
- **Process layout on desktop:** the lit stage is pinned in the left column while the steps scroll past on the right.
- **Contact section** (draft): the line "Say the word. We’ll set the stage." and the four enquiry types (Venue or organisation, Existing client, Freelancer, Partner). Phone and location were removed to match the Loop-style layout; add them back to the note under the button if wanted.
- **Section headings** (draft copy, not from the brief): "Five steps. One seamless handover.", "The full production, covered.", "Scaled to your ambition.", "Begin with the brief.", "Your cue."

## Questionnaire emails

GitHub Pages can't send email, so the form posts to [Formspree](https://formspree.io):

1. Sign up with the address that should receive submissions.
2. Create a form. Formspree gives you a URL like `https://formspree.io/f/abcdwxyz`.
3. Paste that URL in place of `[FORMSPREE_ENDPOINT]`.

Until this is done, pressing Send shows a short "not connected yet" message.

## Deploy to GitHub Pages

1. Create a repository on GitHub (for example `[GITHUB USERNAME]/website`) and push these files to the `main` branch.
2. In the repository, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. The site goes live at `https://[GITHUB USERNAME].github.io/website/`. A custom domain (such as skylinestory.com) can be added on the same settings page.
