# Relationships page matches the current ORM

Date: 2026-11-06

## Problem

The Relationships page described an older ORM. It declared relationships as `BelongsTo("Post")`, which now raises a `DeprecationWarning` (removed in 1.x), and left keys out in ways the code can't handle: with no keys, `BelongsTo("User")` and `BelongsToMany("Tag")` build `where_has` SQL against a `None` column (`users.None = posts.id`). It also showed awaiting a relationship that wasn't loaded (`await shipment.from_country`), but that now raises `LazyLoadingViolation`. It left out `HasOne`, has one of many (`latest_of_many`, `oldest_of_many`, `of_many` with `@relationship`), `MorphTo`/`MorphMany`, nested and constrained eager loading, `load()`, `or_where_has`, the `BelongsToMany` options, and `attach`/`detach`. The Post example in `models.md` used the same deprecated form.

## Alternatives

1. **Rewrite the page around the current API, ordered like Laravel's Eloquent Relationships (chosen).** Each relationship type gets its signature, a parameter table, and an example that ran against framework `main`.
2. **Patch only the wrong examples.** Rejected: the deprecated declaration form appears in every example, and the missing features are the ones readers use most.
3. **Document every exported class, including `MorphOne` and `MorphToMany`.** Rejected: they take a callable whose name becomes the attribute, which is a different API from the rest, and they have no clear typed form yet. They are reported as gaps instead.

## Decision

`docs/database/relationships.md` covers, in order: defining relationships with `X["Model"](...)` and keyword keys (with a tip to always pass keys and a deprecation warning for the old form), `HasOne`, `BelongsTo`, `HasMany`, has one of many, `BelongsToMany` (all constructor options, `attach`/`detach`, the pivot attribute, `with_fields`, the pivot model), `HasOneThrough`, `HasManyThrough`, `MorphTo`/`MorphMany` with `Registry.morph_map`, eager loading (`with_`, dot notation, dict callbacks, `load()` on a model and a collection, `LazyLoadingViolation`), `where_has`/`or_where_has`, and a full model reference. The page notes that columns must be annotated for `attach()` to set foreign keys, and that `attach()` writes only the pivot keys and timestamps.

Each relationship section shows a **Table Structure** block (tables and columns, in the `name - type` style Laravel's docs use) followed by a **Model Structure** block that defines every model involved, so readers can see which column each key argument names. BelongsTo uses `users.role_id` → `roles.id`.

`docs/database/models.md` gets the same declaration form in its Post example.

Left out, because the framework lacks them or they misbehave, and reported to the PM:

- `has()`, `doesnt_have()`, `where_doesnt_have()`, `with_count()` and `with_exists()` don't exist on the query builder.
- `HasMany.attach()` and `BelongsTo.attach()` with an unsaved record call `create(..., cast=True)`, which raises `TypeError`.
- `MorphTo` eager loading matches parents by primary key alone, so two parents of different types with the same id can resolve to the wrong model.
- Nested eager loads of two different top-level relationships in one `with_()` call keep only the last one.
- `attach()` can't write extra pivot columns.
- A `with_fields` pivot column whose name matches a relationship on the related model (pivot `role` vs `User.role`) raises `LazyLoadingViolation` during eager loading. The page warns about this.

## Implementation

- `docs/database/relationships.md`: rewritten.
- `docs/database/models.md`: Post example uses `X["Model"](...)` with explicit keys.

## Validation

- A scratch script outside both repos built every model on the page against SQLite with framework `main` and checked each example: all relationship types eager loaded, nested and constrained eager loads, `load()` on a model and a collection, `LazyLoadingViolation`, has one of many (latest, oldest, `of_many` by column, empty parent, and inside `where_has`), `BelongsToMany` attach/detach, the pivot attribute, `attribute=`/`with_fields=`/`pivot_id=None`, the through relationships, `MorphTo`/`MorphMany`, `where_has`/`or_where_has` with and without callbacks, and the deprecation warning. All 36 checks passed.
- `npm run docs:build` succeeds.
