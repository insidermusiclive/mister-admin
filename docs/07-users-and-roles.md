# 7. Users and roles

The normal setup is **one Mister Admin per person, in that person's own Cloudflare account**.
You are then the only user and the administrator of your own installation. Nothing in this
document is required for that; you can stop reading here.

The roles below exist for the case where one installation is shared, for example a small
business where two colleagues edit the same site, or an agency managing several clients.

## Accounts

- Only an **administrator** can create accounts (top bar → Users → New user).
  Give the person their email and the password you chose; they can change it under
  their name → Your account.
- The very first account (created on the Welcome screen) is an administrator.
- Administrators can reset anyone's password (Users → Edit). Doing so logs that person out everywhere.
- An administrator cannot delete themselves or remove their own admin flag.

## Roles per site

Open a site → **People** to give access.

| | Viewer | Editor | Owner | Administrator |
|---|---|---|---|---|
| See content and photos | ✓ | ✓ | ✓ | ✓ |
| Edit content, upload photos | | ✓ | ✓ | ✓ |
| Publish | | ✓ | ✓ | ✓ |
| Trigger deploy hook | | ✓ | ✓ | ✓ |
| Change settings and schema | | | ✓ | ✓ |
| Add / remove people | | | ✓ | ✓ |
| Backup and restore | view only | view only | ✓ | ✓ |
| Create / delete sites | | | | ✓ |
| Manage users | | | | ✓ |

Administrators have owner rights on every site without needing a membership.

## Family: separate installations (recommended)

Each person installs their own Mister Admin ([03-setup-cloudflare.md](03-setup-cloudflare.md)).
Nothing is shared, nobody depends on anybody, and each person's data stays in their own account.

## Family: one shared installation (alternative)

1. You are the administrator.
2. Create a user for each person (Users → New user).
3. On their site → People → add their email as **owner** or **editor**.
4. They log in at your admin URL and see only their own site(s).

## Sessions

Sessions last 30 days (`SESSION_DAYS` in `wrangler.toml`). Signing out ends the session
immediately. After 8 failed logins from the same address the email is blocked for 15 minutes.
