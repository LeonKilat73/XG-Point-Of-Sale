# Changelog

## 2026-08-18

### Display & UX
- Item descriptions are now click-to-expand, same as Inventory.
- Currency switched to ₱ (Philippine pesos).
- Category filtering changed from pill buttons to a dropdown (Checkout/Quotes, then Catalog).
- Catalog page is now paginated (20 per page), matching Inventory's Items treatment.
- Header and Analytics dashboard made mobile-friendly.
- Staff page's "Add staff member" card widened so the schedule editor's time fields no longer wrap awkwardly.

### Staff scheduling & shift management
- Added weekly recurring schedules per staff member, settable when adding staff or editable afterward.
- Added a "shift ending soon" popup for clocked-in cashiers, based on their schedule.
- Revamped Clock In/Out into a single control: clicking "Clock out" confirms and signs out together; a "Clock in?" prompt appears after login if not yet clocked in.
- The "Clock in?" prompt's Dismiss option is now hidden for cashiers — they must clock in to proceed. Managers/admins can still dismiss it.

### Staff account management
- Adding a cashier/manager now sends a real invite email instead of setting a temporary password — they set their own password on first login.
- Added a "Forgot password?" self-service reset link on the login page.
- Added permanent staff-account deletion, gated on the account being deactivated first. Deleting an active account, or one with real order/shift history attached, is blocked with a clear explanation instead of failing silently.
- Added a plain Log out button for managers/admins in the header — previously the only way to sign out was via "Close cashier" on the Clock In/Out button, which forced them through a fake clock-in cycle. Cashiers still sign out exclusively via Close cashier, tied to ending their shift.

### Fixed
- A production outage (`ERR_TOO_MANY_REDIRECTS`) caused by a database permission gap on the newly added staff schedule column — real logins were failing invisibly. Fixed at the database level.
- The "Create the manager account" link on the login page was showing even after real staff already existed; now correctly hidden once staff exist.
- "Forgot password?" failed with a PKCE "code verifier not found" error whenever the reset link was opened on a different browser or device than the one that requested it (the normal case — e.g. requesting on desktop, opening the email on a phone). The server's Supabase client was defaulting to PKCE flow; switched to implicit flow, which this app needs anyway since it has no OAuth sign-in.

### Known issue
- The project's default Supabase email sender has a low rate limit; hitting it surfaces as "email rate limit exceeded" on invites/resets. Not urgent — resolves on its own within about an hour, or can be removed permanently by connecting a real email provider (e.g. Resend).
