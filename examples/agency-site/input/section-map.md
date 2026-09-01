# Section map, Agency Site

Stage 4 of the design to theme pipeline. This table is the build plan: every row
is one thing to author, and nothing is authored that is not on it.

| Design section | Core block | Target file | Repeats |
|---|---|---|---|
| Header | Group (flex) with Site Title and Navigation | `parts/header.html` | Every page |
| Hero | Cover, `alignfull`, solid `dark` overlay | `patterns/hero.php` | No, but registered so a second landing page can reuse it |
| Services | Group (`alignfull`, `neutral`) containing Columns of three Group cards | `patterns/services-grid.php` | Card repeats three times, so the card is inside the pattern rather than pasted |
| About | Media & Text, media right, stacks on mobile | `patterns/about-media-text.php` | No |
| CTA | Group (`alignfull`, `primary`) with centred heading and Buttons | `patterns/cta-band.php` | Yes, appears on service pages too |
| FAQ | Group containing three Details blocks | `patterns/faq.php` | Yes |
| Blog teaser | Query Loop, `perPage` 3, grid layout | `templates/front-page.html` | No |
| Footer | Group with a centred paragraph | `parts/footer.html` | Every page |
| Post listing | Query Loop, inherited query | `templates/index.html` | Archive only |
| Single post | Post Title, Post Date, Post Content | `templates/single.html` | Every post |
| Page | Post Title, Post Content | `templates/page.html` | Every page |

## Why five patterns and not one page

Everything that appears more than once is a registered Pattern, per the house
rules. The hero and the About section appear once today and are still patterns,
because a pattern costs nothing extra to register and the second landing page
always arrives.

## Soft hyphens

`Verkkosivustot` and `Verkkokaupat` are long enough to wrap badly in an `h3` at
the mobile breakpoint. Both carry a manual `&shy;` at the compound boundary:
`Verkko&shy;sivustot`, `Verkko&shy;kaupat`. The validator's `soft-hyphen-hint`
rule only flags words of 15 letters or more, and at 14 and 12 letters these two
sit under that floor, so the hyphens here were placed by judgement during
stage 5, not prompted by the rule.
