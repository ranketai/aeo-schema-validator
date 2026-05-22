#!/usr/bin/env node
// aeo-schema-validator — Validate a page's schema.org JSON-LD for
// Answer Engine Optimization (AEO) readiness. Zero dependency, Node 20+.
//
// Repo: https://github.com/ranketai/aeo-schema-validator
// Built by RanketAI — https://ranketai.com

import { readFileSync } from 'node:fs'

// schema.org 권장 13종 — AI 답변 엔진(AEO) 인용 친화적 type 우선순위
const RECOMMENDED_TYPES = [
  'Organization', 'Corporation', 'WebSite', 'WebPage', 'Article',
  'Product', 'BreadcrumbList', 'FAQPage', 'LocalBusiness', 'Person',
  'Event', 'CollectionPage', 'Service',
]

// AI 답변 엔진이 특히 선호하는 type — 미존재 시 권고
const AEO_PRIORITY_TYPES = ['FAQPage', 'HowTo', 'Article', 'BreadcrumbList', 'Organization']

// type 별 schema.org 표준 필수/권장 필드
const TYPE_REQUIREMENTS = {
  Organization:   { required: ['name'], recommended: ['url', 'logo', 'sameAs'] },
  WebSite:        { required: ['name', 'url'], recommended: ['publisher', 'inLanguage'] },
  WebPage:        { required: ['name'], recommended: ['url', 'isPartOf', 'inLanguage'] },
  Article:        { required: ['headline', 'author', 'datePublished'], recommended: ['publisher', 'image', 'dateModified'] },
  BlogPosting:    { required: ['headline', 'author', 'datePublished'], recommended: ['publisher', 'image', 'dateModified'] },
  Product:        { required: ['name'], recommended: ['image', 'offers', 'brand'] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  FAQPage:        { required: ['mainEntity'], recommended: [] },
  HowTo:          { required: ['name', 'step'], recommended: ['totalTime', 'estimatedCost'] },
  Person:         { required: ['name'], recommended: ['url', 'sameAs', 'jobTitle'] },
  LocalBusiness:  { required: ['name', 'address'], recommended: ['telephone', 'openingHours'] },
  Event:          { required: ['name', 'startDate', 'location'], recommended: ['endDate', 'description'] },
  CollectionPage: { required: ['name'], recommended: ['url', 'hasPart'] },
  Service:        { required: ['name'], recommended: ['provider', 'serviceType'] },
  SoftwareApplication: { required: ['name'], recommended: ['applicationCategory', 'operatingSystem', 'offers'] },
  DefinedTerm:    { required: ['name'], recommended: ['inDefinedTermSet', 'description'] },
}

// Organization 정식 속성이 아닌 것 — validator warning 패턴
const ORGANIZATION_INVALID_PROPS = ['inLanguage', 'publisher']

function parseArgs(argv) {
  const args = { url: null, html: null, json: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--html') args.html = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    else if (!args.url) args.url = a
  }
  return args
}

function printHelp() {
  process.stderr.write(`
aeo-schema-validator — Validate JSON-LD schema.org markup for AEO readiness.

Usage:
  node index.js <URL>                  Validate live URL
  node index.js --html <FILE>          Validate local HTML file
  node index.js <URL> --json           Output machine-readable JSON

Checks:
  • JSON-LD syntax validity
  • Detected @type coverage vs 13 recommended types
  • Required and recommended fields per @type
  • AEO best practices:
      - Organization invalid props (inLanguage, publisher)
      - @id cross-link usage
      - Priority type presence (FAQPage, HowTo, Article, ...)

Spec: https://schema.org · https://json-ld.org
Built by RanketAI — https://ranketai.com
`)
}

async function loadHtml(args) {
  if (args.html) return readFileSync(args.html, 'utf8')
  if (args.url) {
    const res = await fetch(args.url, {
      headers: { 'User-Agent': 'aeo-schema-validator/0.1' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`fetch failed (${res.status}): ${args.url}`)
    return await res.text()
  }
  throw new Error('no input — provide URL or --html <FILE>')
}

function extractJsonLdBlocks(html) {
  const blocks = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1].trim())
  }
  return blocks
}

function parseBlocks(blocks) {
  const parsed = []
  const syntaxErrors = []
  blocks.forEach((raw, idx) => {
    try {
      parsed.push({ index: idx, json: JSON.parse(raw) })
    } catch (e) {
      syntaxErrors.push({ index: idx, error: e.message, preview: raw.slice(0, 80) })
    }
  })
  return { parsed, syntaxErrors }
}

// 모든 entity (단일 객체, 배열, @graph 안 객체) 를 평탄화
function collectEntities(json) {
  const entities = []
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node['@graph'])) { node['@graph'].forEach(visit); return }
    if (node['@type']) entities.push(node)
  }
  visit(json)
  return entities
}

function typeNameOf(entity) {
  const t = entity['@type']
  if (Array.isArray(t)) return t[0]
  return t
}

function validateEntity(entity) {
  const type = typeNameOf(entity)
  const req = TYPE_REQUIREMENTS[type]
  const findings = []

  if (req) {
    for (const field of req.required) {
      if (!(field in entity)) {
        findings.push({ level: 'error', message: `${type}: missing required field '${field}'` })
      }
    }
    for (const field of req.recommended) {
      if (!(field in entity)) {
        findings.push({ level: 'warn', message: `${type}: missing recommended field '${field}'` })
      }
    }
  }

  // Organization 정식 속성 위반 — schema.org/Organization 의 properties 에 없는 것
  if (type === 'Organization') {
    for (const prop of ORGANIZATION_INVALID_PROPS) {
      if (prop in entity) {
        findings.push({
          level: 'warn',
          message: `Organization: '${prop}' is not a valid schema.org/Organization property — use 'knowsLanguage' instead of 'inLanguage'; remove self-referencing 'publisher'`,
        })
      }
    }
  }

  // @id cross-link 권장 — root-level entity 가 @id 없으면 알림
  if (!entity['@id'] && ['Organization', 'Person', 'WebSite', 'Product', 'SoftwareApplication'].includes(type)) {
    findings.push({
      level: 'info',
      message: `${type}: no @id — consider adding "@id" for entity graph cross-linking (helps AI engines confirm entity identity)`,
    })
  }

  // sameAs 외부 anchor 권장 — Organization·Person
  if (['Organization', 'Person'].includes(type) && !entity.sameAs) {
    findings.push({
      level: 'info',
      message: `${type}: no sameAs — link external profiles (Wikipedia, LinkedIn, GitHub, Wikidata) to strengthen entity identity`,
    })
  }

  return findings
}

function analyzeCoverage(entities) {
  const detected = new Set(entities.map(typeNameOf).filter(Boolean))
  const missing = RECOMMENDED_TYPES.filter(t => !detected.has(t))
  const missingPriority = AEO_PRIORITY_TYPES.filter(t => !detected.has(t))
  return { detected: [...detected], missing, missingPriority }
}

function formatHumanReport(report) {
  const out = []
  out.push(`\n📄 ${report.source}`)
  out.push(`\n${'─'.repeat(60)}`)
  out.push(`\n🧩 JSON-LD blocks: ${report.blocksFound} found, ${report.entitiesFound} entities`)

  if (report.syntaxErrors.length > 0) {
    out.push(`\n❌ Syntax errors:`)
    for (const e of report.syntaxErrors) {
      out.push(`   • block #${e.index + 1}: ${e.error}`)
    }
  }

  out.push(`\n📊 Coverage (13 recommended types)`)
  for (const t of RECOMMENDED_TYPES) {
    const present = report.coverage.detected.includes(t)
    out.push(`   ${present ? '✓' : '·'} ${t}`)
  }

  if (report.coverage.missingPriority.length > 0) {
    out.push(`\n⚠️  Missing AEO-priority types: ${report.coverage.missingPriority.join(', ')}`)
    out.push(`   These types help AI answer engines (ChatGPT, Perplexity, Gemini) cite your content.`)
  }

  out.push(`\n🔍 Per-entity findings`)
  for (const item of report.entityFindings) {
    if (item.findings.length === 0) {
      out.push(`\n   ✓ ${item.type}: no issues`)
      continue
    }
    out.push(`\n   ${item.type}:`)
    for (const f of item.findings) {
      const icon = f.level === 'error' ? '✗' : f.level === 'warn' ? '⚠' : 'ℹ'
      out.push(`     ${icon} ${f.message}`)
    }
  }

  const errors = report.entityFindings.flatMap(e => e.findings).filter(f => f.level === 'error').length
  const warns  = report.entityFindings.flatMap(e => e.findings).filter(f => f.level === 'warn').length
  out.push(`\n${'─'.repeat(60)}`)
  out.push(`\nSummary: ${errors} error(s), ${warns} warning(s), ${report.syntaxErrors.length} syntax issue(s)`)
  out.push('')
  return out.join('\n')
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.url && !args.html) { printHelp(); process.exit(1) }

  const source = args.url || args.html
  process.stderr.write(`Validating: ${source}\n`)

  const html = await loadHtml(args)
  const blocks = extractJsonLdBlocks(html)
  const { parsed, syntaxErrors } = parseBlocks(blocks)

  const entities = parsed.flatMap(p => collectEntities(p.json))
  const coverage = analyzeCoverage(entities)

  const entityFindings = entities.map(e => ({
    type: typeNameOf(e),
    findings: validateEntity(e),
  }))

  const report = {
    source,
    blocksFound: blocks.length,
    entitiesFound: entities.length,
    syntaxErrors,
    coverage,
    entityFindings,
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write(formatHumanReport(report))
  }

  // exit code reflects severity for CI integration
  const hasErrors = syntaxErrors.length > 0
    || entityFindings.some(e => e.findings.some(f => f.level === 'error'))
  process.exit(hasErrors ? 1 : 0)
}

main().catch(err => {
  process.stderr.write(`error: ${err.message}\n`)
  process.exit(2)
})
