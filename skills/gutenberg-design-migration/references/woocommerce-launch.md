# Stage 7: WooCommerce, data and going live

The six stages above end when the theme validates and activates. Everything
below is what a real shop needs after that, written from one migration of an
8 781-product WooCommerce catalogue onto a block theme. Each item cost time to
find; none of it is guessable from the markup.

Read this **before** stage 3 if the target is a shop, not a brochure site. Half
of it changes decisions made in the scaffold.

---

## 1. Verification: how to know you actually fixed it

This is first because it is the difference between one round and five.

- **The assertion must name the thing you changed.** "The gallery is 643px" was
  green for four rounds while the well inside it was stuck at 512. Measure the
  element whose CSS you edited, not its container.
- **A registered block can still render nothing.** `product-meta`,
  `related-products` and `product-reviews` are containers: no inner blocks, no
  output, no error. Registration checks pass. Assert *renders-non-empty*.
- **Don't assert on a class name that also appears in a stylesheet.** Counting
  `wp-block-post-featured-image` in the HTML found 46 matches for 12 cards,
  because core's CSS mentions it. The check would have passed with zero media
  rendered.
- **`document.hidden` freezes CSS transitions and rAF.** A headless or
  background tab reports `opacity: 0` on an element that is fully open. Check
  `document.hidden` before believing a probe, or assert on geometry and classes
  instead.
- **Only count elements with their own text node.** A luminance sweep for
  unreadable text reported 19 hits, 13 of which were wrapper elements
  inheriting a colour they never painted.
- **Measure warm and cold separately.** Cached HTML came back in 8 ms and
  uncached in 0.5–2.2 s. Optimising the wrong one wastes a day. Profile with a
  temporary mu-plugin that timestamps `plugins_loaded`, `init`, `wp`,
  `template_redirect`, `wp_footer`, `shutdown` — the theme's own code was 80 ms
  of a 2.2 s page.
- **Write a smoke test early and run it after every deploy.** ~30 assertions
  covering the paths that have broken silently. Exit non-zero. Deliberately
  break one check to prove it fails.
  Note: `wp eval-file` does **not** run in global scope, so counters must live
  in `$GLOBALS` or every assertion silently passes.

## 2. WooCommerce block behaviour you cannot see in the markup

- Cart and Checkout are **React apps**. Server-side `gettext` never reaches
  them; they translate via `wp.i18n` in JS. Their inner structure comes from the
  block tree, not from anything you can author.
- **`perPage` is ignored when a collection has `inherit: true`** — the block
  runs the main query, so `loop_shop_per_page` decides.
- Client-side filtering needs **`isProductCollectionBlock: true`** in the query
  attrs; hand-written markup lacks it and every filter change becomes a full
  page load. Filter blocks get the collection's `queryId` through
  `render_block_context`, not through nesting — nesting kills the AJAX.
- **The related-products collection supplies a precomputed `post__in`**, not a
  taxonomy condition. Adding your own condition *intersects* that list and can
  produce an empty section on some products and a full one on others. Replace
  the list, don't filter it.
- **`queryId` lives in different places depending on the filter.** In
  `query_loop_block_query_vars` the block's attrs are empty and
  `$block->context['queryId']` carries. In `render_block_*` the collection is
  the context *provider*, so its own context has no `queryId` — read
  `$block['attrs']['queryId']`.
- The taxonomy filter renders **twice** (desktop rail + mobile drawer) and ships
  every term in `data-wp-context`. On a 541-term catalogue that is 179 kB of
  attribute and ~600 ms of build time. Prune the context server-side.
- Woo's checkbox list renders only the first 15 rows; the rest are painted by
  the Interactivity runtime, carry no context and start `hidden`. A server-side
  class reaches 15 rows and silently misses the rest.
- **Woo's stylesheet loads after the theme's.** Every specificity tie goes to
  Woo. `is-flex-container` forces `flex-wrap: wrap`; the grid item needs an
  explicit width; the cart has its own phone layout under 699px that overlaps
  your own.
- **Woo's REST image whitelist is narrower than WordPress's** — AVIF is
  rejected with a permissions-sounding error.

## 3. Caching: the layer that makes correct code look broken

- **Nothing user-specific may be rendered server-side into cached HTML.** A cart
  count in PHP is either permanently zero or, worse, one shopper's basket shown
  to everyone. Fetch it in the browser, and only when the cart cookie exists.
- **Page-caching the Store API breaks the cart**: every visitor gets the same
  stale nonce and every mutation returns 409. Turn `cache-rest` off and verify
  with `curl -D-` that the cart endpoint is not a cache hit.
- **Minified CSS/JS copies are keyed on `?ver=`.** Purging the page cache does
  not invalidate them. Bump the theme version whenever a theme asset changes,
  and the `block.json` version whenever a block asset changes — otherwise the
  browser keeps the old file and the fix "doesn't deploy".
- **Combining CSS is usually safe, combining JS is not.** Block scripts and the
  React cart depend on execution order.
- **Search and cart pages are deliberately uncached — and therefore
  unoptimised.** They load every stylesheet separately. Expect them to be the
  heaviest pages on the site.
- **Warm the cache.** With thousands of products most visits would otherwise
  hit a cold page. LiteSpeed's crawler needs a sitemap URL *and* one manual
  "Refresh Map" in wp-admin; the CLI reports `[total] 0` until then.
- **Editing terms with direct SQL leaves WooCommerce's own caches stale.**
  `wc_taxonomy_hierarchy_product_cat` (an option, not a transient) and
  `wc_filter_data_*` transients keep the old slugs. Symptom: a category
  disappears from the filter tree with no error. `wp cache flush` does not help
  — it is stored data. Search the options table for the old string.

## 4. Importing a real catalogue

- **Run the importer under WP-CLI, never the browser.** Same class, no AJAX
  timeouts. `require_once` the importer files; Woo's autoloader does not find
  them.
- **`wp eval-file` without `--user=1` silently drops every category**:
  `parse_categories_field()` starts with a capability check and breaks out of
  the loop. Tags are unaffected, so the damage looks random.
- **`update_existing => true` does not create missing products** — it skips
  them. A bulk import is two passes over the same file.
- **Match by SKU, never by name or exported ID.** Names are exactly what
  changes between exports; IDs point at the source install.
- **Force GD for the image pass.** Imagick allocates outside PHP's
  `memory_limit` and the process is SIGKILLed (exit 137) with no log line — one
  oversized source image kills the run.
- **Split long imports into short processes** with a byte-offset state file, so
  a killed process costs one batch.
- Product bundles and other add-on types are rejected wholesale if the plugin is
  absent; convert the type in the source data.

## 5. Replacing a live site at the same address

If the new site takes over the old domain, **adopt the old slugs** instead of
building a redirect table. A redirect is an extra hop and thousands of rows to
maintain.

- Products pair by **SKU**; categories have no SKU, so pair by **name path**
  ("BMW › 3-sarja › F30") — the import carried names, not slugs.
- **Rename in two passes**: give every changing row a temporary slug, then the
  target. Otherwise chains and swaps stay unresolved (43 conflicts became 2).
- Write with SQL, not `wp_update_post`: the only changing column is `post_name`,
  and the save chain costs ~25 ms per product.
- **`_wp_old_slug` redirects do not work for pages** — core requires the `name`
  query var and pages use `pagename`. Map renamed pages by hand.
- **Turn off `redirect_guess_404_permalink`.** On a large catalogue it sends
  `/cart/` to a product called "Cartec sponge". A clean 404 is better than a
  confident wrong answer.
- Sample the old sitemap before and after and report the hit rate; on this
  migration it went from 65 % to 99 %.

## 6. Design details that only appear in production

- **A palette slug named `text` breaks every colour defined before it.**
  WordPress emits `.has-text-color { color: … !important }` for the named
  colour, which is byte-identical to the marker class every coloured block gets.
  Same specificity, same `!important` — source order decides. Half the palette
  silently rendered as the text colour. Either rename the slug or re-emit each
  colour with a `:root` prefix.
- **Text over photography must use fixed white**, not a palette token that flips
  with the colour scheme. Scope the rule to the cover block, not to one section,
  so the next section inherits it.
- **`[hidden]` is a UA rule that any author `display` beats.** An element with
  `display: flex` that JS hides with `hidden` stays visible — and if it is a
  `position: fixed` overlay it swallows every click on the page. One defensive
  `[hidden] { display: none !important }` is worth more than fixing the third
  occurrence.
- **A media query adds no specificity.** An override placed next to the first
  of three declarations loses to the last one. Put breakpoint overrides at the
  end of the file.
- **Server-rendered blocks get no layout class.** `is-layout-grid` gives
  `display: grid` and nothing else; the column count must come from your own
  CSS. The bug hides on mobile, where the narrow breakpoints use `!important`.
- **Imported copy carries the old editor's typography.** Fixed `color`,
  `font-family`, `font-size`, `line-height` — black on a dark theme, white on a
  light one. Strip it at render time, not in the database: the catalogue is
  re-imported and a cleaned database reverts.
- Don't close over element data in a click handler when the list can reorder:
  the Interactivity runtime reuses DOM nodes, so the handler ends up toggling a
  different row. Read the key from the row at click time.

## 7. Launch checklist beyond the theme

- [ ] Old→new URL parity measured on a sample of the old sitemap
- [ ] SEO plugin active, sitemap responding
- [ ] Analytics/tag manager container carried over, gated to the production host
      so staging never pollutes production data
- [ ] Consent banner present before any tracking fires
- [ ] Cache crawler map generated
- [ ] Staging closed to the public if it holds real customer data
- [ ] One real order end to end: payment, confirmation email, shipping label
- [ ] Absolute staging URLs converted in post content
- [ ] Search engines unblocked
