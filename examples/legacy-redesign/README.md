# Migration example: Legacy Redesign

A design produced before anyone said the site would be built in Gutenberg, and
the stage 1 report that flattens it.

```
input/design.html         the non-conforming design
buildability-report.md    stage 1 in flattening mode, status blocked
```

There is no theme here, deliberately. The pipeline stops at stage 1 when a
design carries blockers, and that stop is the whole point of the example. The
alternative, discovered in real projects, is authoring half a theme and then
finding out the hero cannot be built.

Four blockers: an overlapping hero card, an absolutely positioned badge, a
diagonal `clip-path` mask, and `:has()` state styling. Each has a flattened
equivalent in the report, along with what it costs to keep it instead.

Compare with `examples/agency-site/`, where the same stage runs against a design
written with the constraint stated up front and finds nothing blocking.
