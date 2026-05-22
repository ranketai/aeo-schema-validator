# aeo-schema-validator

Validate a page's [schema.org JSON-LD](https://json-ld.org) markup for **AEO (Answer Engine Optimization)** readiness — see how well your structured data prepares your site for citations by ChatGPT, Perplexity, Gemini, and other AI search engines.

- ⚡ **Zero dependency** — single file, Node 20+ (uses built-in `fetch`)
- 🧩 **13 recommended types coverage** — Organization, Article, FAQPage, BreadcrumbList, Product, ...
- 🎯 **AEO-priority signals** — flags missing FAQPage, HowTo, Article, Organization
- 🔗 **Entity graph awareness** — checks `@id` cross-linking and `sameAs` external anchors
- 🛡️ **Invalid property detection** — catches common mistakes (e.g. Organization with `inLanguage`/`publisher`)
- 📊 **Machine-readable output** — `--json` for CI integration

## Why AEO matters

Search is shifting from blue links to AI-generated answers. ChatGPT, Perplexity, and Gemini cite sources, but only sites with well-structured metadata get cited. JSON-LD `schema.org` markup is the primary signal AI engines use to understand entity identity, content type, and answer-readiness.

This validator is built by [RanketAI](https://ranketai.com) — an AI brand visibility platform — based on the same checks used in [`ranketai.com/en/geo-check/site`](https://ranketai.com/en/geo-check/site).

## Quick start

### Validate a live URL

```bash
node index.js https://example.com
```

### Validate a local HTML file

```bash
node index.js --html ./page.html
```

### Machine-readable output (CI)

```bash
node index.js https://example.com --json > report.json
```

## Example output

```
📄 https://example.com
────────────────────────────────────────────────────────────
🧩 JSON-LD blocks: 1 found, 4 entities

📊 Coverage (13 recommended types)
   ✓ Organization
   ✓ WebSite
   ✓ Article
   · Corporation
   · Product
   ✓ BreadcrumbList
   · FAQPage
   ...

⚠️  Missing AEO-priority types: FAQPage, HowTo
   These types help AI answer engines (ChatGPT, Perplexity, Gemini) cite your content.

🔍 Per-entity findings

   Organization:
     ⚠ Organization: 'inLanguage' is not a valid schema.org/Organization property
       — use 'knowsLanguage' instead

   Article:
     ✗ Article: missing required field 'author'

────────────────────────────────────────────────────────────
Summary: 1 error(s), 1 warning(s), 0 syntax issue(s)
```

## Options

| Flag | Description |
|------|-------------|
| `<URL>` | Live URL to validate (positional) |
| `--html <FILE>` | Local HTML file to validate |
| `--json` | Output machine-readable JSON report |
| `-h, --help` | Show help |

## Checks performed

### 1. JSON-LD syntax

- Every `<script type="application/ld+json">` block must be valid JSON
- Supports `@graph` arrays, nested entities, and multiple blocks per page

### 2. Coverage — 13 schema.org recommended types

Organization · Corporation · WebSite · WebPage · Article · Product · BreadcrumbList · FAQPage · LocalBusiness · Person · Event · CollectionPage · Service

### 3. AEO-priority types

If your page lacks `FAQPage`, `HowTo`, `Article`, `BreadcrumbList`, or `Organization`, AI answer engines have a harder time citing you. The validator flags these gaps explicitly.

### 4. Required and recommended fields

Per `@type`, checks schema.org-defined required fields (errors) and recommended fields (warnings). Examples:

- `Article` requires `headline`, `author`, `datePublished`
- `BreadcrumbList` requires `itemListElement`
- `FAQPage` requires `mainEntity`
- `Organization` recommends `url`, `logo`, `sameAs`

### 5. Common AEO mistakes

- ❌ **`Organization` with `inLanguage` or `publisher`** — neither is a valid `schema.org/Organization` property. `inLanguage` belongs on `CreativeWork`; `publisher` belongs on content entities pointing _to_ the Organization (self-referencing is redundant).
- ⚠️ **No `@id`** on root entities — entity graph cross-linking helps AI engines confirm entity identity across pages.
- ⚠️ **No `sameAs`** on Organization/Person — external anchors (Wikipedia, LinkedIn, GitHub, Wikidata) strengthen entity disambiguation.

## Exit codes (CI integration)

| Code | Meaning |
|------|---------|
| `0` | No errors |
| `1` | Validation errors found (missing required fields, syntax errors, invalid properties) |
| `2` | Runtime error (network failure, file not found) |

## Roadmap

- [ ] npm package + `npx aeo-schema-validator` distribution
- [ ] Microdata / RDFa detection (HTML attribute-based structured data)
- [ ] HTML output report
- [ ] GitHub Action wrapper
- [ ] Comparison mode (before/after diff)
- [ ] Recommended `@id` value generator (`#organization` / `#founder` patterns)

## License

[MIT](LICENSE) © RanketAI / NeoCodeLab

## About RanketAI

Built and maintained by [**RanketAI**](https://ranketai.com) — measure your brand's rank in AI answers.

- 🔍 **Page structure diagnostics** — analyze how AI-citation-ready your page is
- 📊 **Brand visibility analysis** — see how ChatGPT, Perplexity, Gemini mention your brand
- 📈 **Domain monitoring** — track changes, deltas, and competitor comparisons over time

Explore the [glossary](https://ranketai.com/en/glossary), [blog](https://ranketai.com/en/blog), or run a [free site diagnostic](https://ranketai.com/en/geo-check/site).

Related project: [`llms-txt-generator`](https://github.com/ranketai/llms-txt-generator) — generate `llms.txt` from sitemap or markdown directory.
