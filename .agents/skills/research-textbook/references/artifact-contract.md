# Research artifact contract

All files are JSON unless noted. Preserve IDs across research rounds.

## `01-query-plan.json`

```json
{
  "round": 1,
  "queries": [
    {
      "id": "query-consensus-primary",
      "conceptId": "consensus",
      "text": "protocol specification consensus finality",
      "intent": "primary-source",
      "status": "pending"
    }
  ]
}
```

Query status is `pending`, `complete`, or `discarded`.

## `02-source-catalog.json`

```json
{
  "sources": [
    {
      "id": "source-protocol-spec",
      "type": "web",
      "title": "Protocol specification",
      "url": "https://example.com/spec",
      "authority": "primary",
      "independenceGroup": "protocol-maintainers",
      "retrievedAt": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

Source type: `web`, `youtube`, `pdf`, `paper`, `book`, `note`, or `conversation`. Authority: `primary`, `secondary`, `community`, or `learner`. URL is optional only for local notes and conversations.

## `03-evidence-ledger.json`

```json
{
  "claims": [
    {
      "id": "claim-finality",
      "conceptId": "consensus",
      "claim": "A concise atomic claim.",
      "status": "supported",
      "sourceIds": ["source-protocol-spec"],
      "locators": [
        {
          "sourceId": "source-protocol-spec",
          "heading": "Finality"
        }
      ]
    }
  ]
}
```

Claim status: `supported`, `inferred`, `disputed`, or `missing`. Locators may use `heading`, `page`, `timestampStart`, and `timestampEnd`. Every cited source needs a locator. Keep claims atomic so disagreements can be represented accurately.

## `04-concept-graph.json`

```json
{
  "concepts": [
    {
      "id": "consensus",
      "label": "Consensus",
      "importance": "core",
      "prerequisiteIds": ["hashing"],
      "objective": "Explain why participants converge on one state."
    }
  ]
}
```

Importance is `core` or `supporting`. Core concepts participate in the coverage gate.

## `06-curriculum.json`

```json
{
  "title": "Book title",
  "summary": "What the book teaches and how it is organized.",
  "chapters": [
    {
      "id": "chapter-01",
      "title": "Chapter title",
      "objective": "Observable chapter outcome",
      "conceptIds": ["hashing"],
      "evidenceClaimIds": ["claim-hash-determinism"],
      "prerequisiteChapterIds": [],
      "lessonFile": "chapters/chapter-01.json"
    }
  ]
}
```

Prerequisite chapters must appear earlier. Every core concept must occur in at least one chapter and have a matching supported or inferred evidence claim. Each lesson file must satisfy `content/lesson.schema.json`, pass the deterministic lesson validator, and include the catalog URLs used by its evidence claims.
