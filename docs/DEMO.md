# Demo guide

Run the setup in the main README, then open `http://127.0.0.1:3107/login`.

1. Sign in as the public `admin` account. The header reads **Administrative Integrated System** and shows a fictional-data notice without an institutional logo.
2. Open Records (`/weapons/sheet.html`). The seed creates three records with `DEMO-LIC-*` identifiers, unmistakably fictional names and office labels.
3. Open Requests (`/request/index.html`), inspect a fictional record and create a new demonstration request. Repeating the same normalized name is rejected.
4. Use the dashboard's unified search with `DEMO`. It combines seeded records across modules.
5. Open Shared storage (`/storage/index.html`). The supplied text file is constructed by the seed generator and contains no personal information.
6. Open Organizations (`/company/index.html`) to inspect a fictional organization. No logos or scanned originals are supplied.
7. Sign out and sign in as `demo-user`. Only its permitted applications are available; privileged global search and disabled modules are rejected by the server.

The remaining module routes are `/renewal/sheet.html`, `/report/index.html`, `/accept/index.html` and `/seized/index.html`. All default pages and fixtures are local to this checkout.

For a separate demonstration port, set `PORT` in your shell before running `npm start`. For example, PowerShell: `$env:PORT='6221'; npm start`. You may use `PLATFORM_DATA_ROOT=.demo-data/my-demo` to keep that run's fictional edits separate; the server rejects paths outside `.demo-data`.

All demo credentials are deliberately public. Use invented identifiers and names when creating additional examples.
