# Migrating content off a page builder

The six stages build the theme. They say nothing about the several hundred
pages already sitting in the old site, and a hand rebuild of those is where a
migration quietly loses a week. This file covers moving the content itself,
with Elementor as the worked example. Divi, WPBakery and Beaver Builder differ
only in their wrapper class names.

Run this after stage 5, when the templates and patterns exist to receive the
content, and before the stage 6 validation pass so imported markup is checked
along with everything else.

## Read the old site through the REST API, not the rendered HTML

`/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,link,parent,title,excerpt,content,featured_media`
gives the page tree, the hierarchy and the builder's own saved output in one
request per hundred pages. Scraping the rendered page instead drags in the
header, footer, cookie banner and related-posts widgets, and then you are
writing selectors to remove them again.

Two details that save a rerun:

- Pull `/wp-json/wp/v2/media` at the same time and key it by id. Hero images
  are almost always the featured image, not an image widget inside the
  content, so a converter that only walks the content finds no hero on most
  pages.
- Multilingual sites expose every translation through the same endpoint.
  Filter by link prefix (`/sv/`, `/en/`) before converting, or you will import
  three copies of the site.

A REST request can be slow on a large site. Fetch the pages with a long
timeout, save the JSON, and convert from the file. Refetching on every run of
the converter turns a fast edit loop into a slow one.

## The converter is a widget walk, not an HTML parse

Page builder output is nested container divs with the actual content in leaf
widgets. Walk the document in order, capture the inner HTML of the widget
types that carry content, and ignore the containers entirely:

| Elementor widget class | Becomes |
|---|---|
| `elementor-widget-heading` | `wp:heading` |
| `elementor-widget-text-editor` | `wp:paragraph`, `wp:list` per child element |
| `elementor-widget-button` | `wp:buttons` > `wp:button` |
| `elementor-widget-image` | `wp:image`, or a hero candidate |
| everything else | dropped |

Inside a text editor widget, split on the child `<p>`, `<ul>`, `<ol>` and
`<h2>`-`<h6>` elements rather than treating the whole widget as one paragraph.
Strip every inline tag except `strong`, `em`, `a`, `br`, `sup`, `sub`. The
builder's spans carry its own utility classes, and those classes have no
stylesheet in the new theme.

## Four things that come out wrong by default

**The page title appears twice.** The builder puts an H1 heading widget in the
content; the block template renders `wp:post-title`. Compare the first heading
against the page title and drop it when they match. Compare with soft hyphens
stripped: a title carrying `&shy;` will not match its own plain text.

**Photo credits land in the body copy.** A short standalone paragraph starting
"Kuva:" / "Photo:" is a caption that was positioned over the hero image. Pull
it out into a caption field rather than leaving it as the first paragraph of
the page.

**The lead paragraph is not always a lead.** Promoting the first paragraph to
`post_excerpt` is right when the template renders an excerpt beside the hero,
but only when it is short. Bound it to roughly 30 to 400 characters, and leave
anything longer in the content where it belongs.

**Links keep the old domain.** Rewrite `https://old-domain.fi/` to
root-relative in every `href` during conversion. Doing it afterwards means a
search and replace across a database you have already published.

## Import idempotently

Write one record per page as NDJSON, sort roots before children so parents
resolve, and have the import script look up each slug before deciding between
`wp post create` and `wp post update`. You will run the import more than once,
and a script that only creates leaves you deleting duplicates by hand.

Slug renames belong in an explicit table in the import script. The old
information architecture is rarely the new one, and a rename map is also the
list of redirects the launch needs.

## What does not survive, and should not

Forms, sliders, accordions built as builder widgets, and anything reading live
data do not convert. They are the same items stage 1 already listed as
accepted costs. Emit a placeholder, a shortcode block for a ported module or
`wp:details` for an accordion, and keep the list of what got stubbed. That
list is the remaining work, and it is much shorter than it looks before
conversion.
