# Patterns

WordPress discovers every `.php` file in this directory automatically. A
pattern file needs this header and nothing else:

```php
<?php
/**
 * Title: Hero
 * Slug: agency-site/hero
 * Categories: agency-site
 */
?>
<!-- wp:cover ... -->
```

House rules that apply to every file here:

- Core blocks only. A custom block is a last resort, and it costs a build step
  plus a deprecation every time the markup changes.
- Colours, font sizes and spacing reference theme.json preset slugs. No hex.
- Anything appearing on more than one page belongs here rather than being
  rebuilt per page.
