# 7. Users and roles

Mister Admin is built so that non-technical people can safely manage their own website.

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

## Typical family setup

1. You are the administrator.
2. Create a user for your wife and one for your son.
3. On your wife's site → People → add her email as **owner** (so she can also change the schema
   and invite someone later) or **editor** (content only).
4. Same for your son on his site.
5. Each of them logs in at the admin URL and sees only their own site(s).

## Separate instances instead

If someone wants to be completely independent, they can deploy their own Mister Admin in their
own Cloudflare account ([03-setup-cloudflare.md](03-setup-cloudflare.md)). Nothing is shared.

## Sessions

Sessions last 30 days (`SESSION_DAYS` in `wrangler.toml`). Signing out ends the session
immediately. After 8 failed logins from the same address the email is blocked for 15 minutes.
