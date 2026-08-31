# Going live

The stages before this one end when the theme validates and activates, which
is not the same as a site that is safe to leave running. Everything here
applies to every project, shop or not. `woocommerce-launch.md` adds the
shop's own items on top of this list.

## What WordPress leaves open to the public

Neither of these comes from a plugin or from anything the theme does, and
neither is touched by a rebuild. They are default WordPress behaviour, so the
same two findings return on every site that has not been hardened on purpose,
and both have an obvious fix that does not work. The numbers below are from
one batch of three live sites.

- **`/wp-json/wp/v2/users` lists the accounts to anyone.** The `slug` field is
  the author slug, which on most installs is derived from the login name, so
  the endpoint turns a password guess into a targeted one. It cannot simply be
  closed: the block editor calls it while logged in, and a blanket block breaks
  editing. Drop the `/wp/v2/users` routes in `rest_endpoints` when
  `is_user_logged_in()` is false, and leave `/users/me` alone, where an
  unauthenticated request already gets a 401.
- **That endpoint is one of at least three routes to the same slug.** Closing
  it alone clears the scan and leaves the leak. The other two on all three
  sites were `?author=1`, which `redirect_canonical` turns into
  `/author/<slug>/`, and the SEO plugin's `author-sitemap.xml`, which hands
  the slug to Google in a file built for crawling. Cancel the author redirect
  at priority 0, before `redirect_canonical` runs; set Yoast's
  `disable-author` and flush rewrites; and drop `author_url` from the oEmbed
  response, which carries the slug as well.
- **`xmlrpc_enabled` does not disable XML-RPC.** The filter only rejects the
  methods that require authentication. `pingback.ping` requires none, so the
  amplification vector stays open and the endpoint still answers.
- **Deny `/xmlrpc.php` before PHP runs, not from inside it.** A mu-plugin has
  already booted the whole of WordPress before it can refuse, and that boot is
  the resource the attack is spending: on the busiest of the three sites 131
  requests reached PHP and the slowest held a worker for 26 seconds. The same
  requests denied in `.htaccess` never start WordPress and answer in about a
  millisecond. Put the deny there, or in the CDN's WAF where it costs the
  server nothing, and keep a mu-plugin only as the layer that survives a
  replaced `.htaccess`.
- **Decide the dependency from the plugin list, never from the traffic.**
  Jetpack, the WordPress mobile app, trackbacks and some older order
  management integrations are real reasons to keep XML-RPC, and
  `wp plugin list --status=active` settles it in one line. The requests lie:
  the credential stuffing arrives with forged `Jetpack/13.0` user agents. Nor
  is any of this theoretical. August logs on the three sites held 107 269, 635
  and 69 xmlrpc requests, and the attack was still running while it was being
  investigated.
- **Expect the traffic to move to `wp-login.php`.** Closing XML-RPC removes
  the cheap door, not the attacker. Whatever rate limit or geo rule guards the
  account pages belongs on the login route too, and after this change it is
  the one that is left.

## The mu-plugin and the .htaccess block

`assets/webaula-endpoint-hardening.php` does all of the above and is the file
as deployed. It goes in `wp-content/mu-plugins/`, where it loads with no
activation step and cannot be switched off from wp-admin. On its own it is the
weaker half: pair it with the deny that runs before PHP, at the top of
`.htaccess`, inside its own markers so a plugin that rewrites the file leaves
it alone.

```apache
# BEGIN WebAula xmlrpc
<Files "xmlrpc.php">
  Deny from all
</Files>
# END WebAula xmlrpc
```

`Deny from all` is Apache 2.2 syntax, which LiteSpeed and any Apache still
loading `mod_access_compat` honour. On a plain 2.4 the equivalent is
`Require all denied`.

Verify from the access log, not from the status code, because a 403 looks the
same whichever layer produced it. The signal is the size and the time. The
mu-plugin answers with its own short body after booting WordPress; the server
answers with its own error page and never starts PHP. One host, one request,
three states: 405 in 154 ms with nothing in place, 403 in 20 ms and 17 bytes
out with the mu-plugin alone, then 403 in 1.1 ms once the deny was in
`.htaccess`. Some hosts also blank the `webroot` field when PHP never ran,
which is the clearest signal where you get it, but do not rely on it: on
another host the field stayed populated for a request the server had already
refused. The SEO plugin needs one setting of its own, which no filter
covers:

```sh
wp option patch update wpseo_titles disable-author true --format=json
wp rewrite flush
```

Rolling back is deleting the file, removing the marked block, and setting
`disable-author` to false.

## The login is what is left

Closing XML-RPC moves the traffic, it does not remove the attacker, and
`wp-login.php` is where it goes. Four things matter there. The asset above
does three of them.

**The login form still answers the question the REST endpoint no longer
does.** WordPress says "Unknown username" for one case and "The password you
entered for X is incorrect" for the other, so the enumeration you closed comes
back through the form. Generalise it on `authenticate` rather than on
`login_errors`: WooCommerce's My Account form never touches the login page,
but it goes through the same authentication chain.

**Application passwords bypass two-factor authentication.** They have been
available by default since 5.6 and no second-factor prompt can interrupt them,
because they are not a form login. Turning 2FA on while leaving them enabled
secures the front door and leaves the side one open. Disable them unless an
integration is using them, and check that before assuming.

**The file editor turns a stolen admin session into code execution** rather
than into vandalism. `DISALLOW_FILE_EDIT` costs one line.

### Two-factor authentication

The fourth, and deliberately not in the asset: it needs a form, a mail
template and a flow of its own, which is more than a hardening file should
carry. One implementation worth copying lives in a WebAula theme as
`inc/two-factor.php`. A six digit code by email after the password, required
only of accounts holding `manage_options` or `manage_woocommerce` so customer
logins are untouched, a trusted device cookie hashed against the first twelve
characters of the password hash so that changing the password invalidates
every remembered device, and a kill switch constant for the day mail stops
flowing. That switch is not a weakness. It is what keeps a mail outage from
locking everyone out of the shop.

Three things that implementation learned the hard way, and any other one will
have to learn too:

- **Hook `authenticate`, not the login form.** The first version guarded
  wp-login.php and left WooCommerce's My Account login entirely outside the
  second factor. On a shop that is not an edge case, it is how the shop
  manager signs in.
- **The field names differ.** wp-login.php posts `log` and `pwd`, Woo's form
  posts `username` and `password`, and the redirect is `redirect_to` in core
  against `redirect` in Woo. Miss the pair and you either skip the check or
  drop the destination.
- **A form cannot interrupt every login.** XML-RPC and application passwords
  authenticate without one, which is the other half of why both are closed
  above. A second factor is only as good as the routes that cannot go around
  it.

## Launch checklist

- [ ] Old→new URL parity measured on a sample of the old sitemap
- [ ] Direct HTTP access to theme `.php` denied (an ABSPATH guard returns an
      empty 200, enough to map the theme's structure; a block theme never
      needs its PHP served, so a one-line `.htaccess` closes it)
- [ ] Server and local theme trees diffed (`find | sort` both sides): a
      multi-file `scp a b host:dir/` lands every file in one directory, and
      the stray copies are what the next reader edits
- [ ] Author slug closed on all three routes: `/wp/v2/users`, `?author=1` and
      the SEO plugin's author sitemap (closing the REST endpoint alone clears
      the scan and leaves the leak)
- [ ] `/xmlrpc.php` denied before PHP runs, in `.htaccess` or the WAF
      (`xmlrpc_enabled` leaves `pingback.ping`, and a mu-plugin has booted
      WordPress before it can refuse)
- [ ] Login errors generalised on `authenticate`, so the form does not answer
      what the REST endpoint no longer does
- [ ] Application passwords disabled, or a note saying which integration needs
      them
- [ ] `DISALLOW_FILE_EDIT` set
- [ ] Two-factor on every account that can manage the site or the shop
- [ ] Rate limit or geo rule on `wp-login.php` at the CDN, where the traffic
      moves once XML-RPC closes
- [ ] Registration settings deliberate: `users_can_register`, Woo's My Account
      registration and its checkout registration each answer a different
      question, and open registration with the default role is how spam
      accounts arrive
- [ ] SEO plugin active, sitemap responding
- [ ] Analytics/tag manager container carried over, gated to the production host
      so staging never pollutes production data
- [ ] Consent banner present before any tracking fires
- [ ] Staging closed to the public if it holds real customer data
- [ ] Absolute staging URLs converted in post content
- [ ] Search engines unblocked
