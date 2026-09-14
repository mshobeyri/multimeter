---
name: multimeter-youtube-post
description: Generate YouTube titles, descriptions, tags, hashtags, chapters, pinned comments, and upload metadata for Multimeter videos. Use when the user asks for YouTube copy, video descriptions, titles, tags, SEO metadata, launch videos, tutorials, demos, or feature videos about Multimeter, Testlight, mmt.dev, API testing, suites, mocks, docs, reports, or CI workflows.
---

# Multimeter YouTube Post

## Purpose

Create YouTube metadata for videos that promote or explain Multimeter while staying accurate, searchable, and useful to developers.

## Product Positioning

Use this core positioning unless the user gives a more specific angle:

- Multimeter is a Git-native API testing platform.
- Start with a single `.mmt` API request and grow into tests, suites, mock servers, reports, generated documentation, and CI workflows.
- It is VS Code-native and file-based, so API workflows can live with the codebase.
- Testlight is the CLI for running Multimeter APIs, tests, suites, load tests, reports, and docs in CI.
- Website: `https://mmt.dev`.
- Test server: `https://test.mmt.dev`.

Do not use `multimeter.dev`.

## Workflow

1. Identify the video topic, target viewer, feature demonstrated, and desired CTA.
2. If the user provides a transcript, screenshots, or video summary, ground the metadata in that content.
3. If details are missing, ask for the video topic or generate cautious copy based only on the provided feature.
4. Produce 3 to 5 title options, one recommended description, tags, hashtags, and optionally chapters or a pinned comment.
5. Keep search intent and viewer clarity ahead of keyword stuffing.

## YouTube Best Practices

- Titles: keep under 60 characters when possible.
- Put the main keyword or topic near the beginning of the title.
- Titles must accurately represent the video. Avoid clickbait that hurts retention.
- Use natural language. Do not cram repeated keywords into titles or descriptions.
- The first 2 to 3 description lines matter most because they appear before "Show more".
- Descriptions should usually be 150 to 300 words for tutorials and demos, or up to about 500 words for deeper explainers.
- Include one primary CTA near the top and another near the end.
- Add chapters when the video has clear sections. Start at `0:00`.
- Tags are a minor discovery signal. Use 5 to 10 targeted tags mainly for topic clarity, synonyms, misspellings, and brand terms.
- Hashtags in the description should be limited to 3, placed near the end.

## Multimeter Keyword Library

Choose only terms that match the video:

- Primary topics: `API testing`, `Git-native API testing`, `VS Code API testing`, `API test automation`, `API mock server`, `API test suite`, `CI API testing`
- Product terms: `Multimeter`, `mmt`, `.mmt`, `Testlight`, `mmt.dev`
- Comparison/search terms: `Postman alternative`, `Bruno alternative`, `file-based API testing`, `developer tools`
- Feature terms: `mock server`, `test suite`, `environment variables`, `generated API docs`, `JUnit report`, `HTML report`, `load testing`

## Output Format

Return:

```markdown
Recommended title:
[Best title under 60 characters if possible]

Title options:
1. [Option]
2. [Option]
3. [Option]
4. [Option]
5. [Option]

Description:
[First 2-3 lines with topic and viewer benefit.]

[Body: what the video covers, grounded in the provided feature/video.]

Links:
- Multimeter: https://mmt.dev
- VS Code extension: [include if user provides or asks]
- Docs/example: [include if user provides or asks]

Chapters:
0:00 [Opening]
[Only include real or clearly inferred chapters when timing is known or requested.]

Tags:
[5-10 comma-separated tags]

Hashtags:
[Exactly 3 hashtags]

Pinned comment:
[Short CTA or question to encourage engagement]
```

If no timestamps are available, either omit `Chapters` or provide an `Suggested chapters, adjust timestamps` section.

## Default Tags

Use a focused subset of these, not all of them:

`Multimeter, Testlight, API testing, API test automation, Git native testing, VS Code extension, developer tools, mock server, test suite, CI testing, mmt, Postman alternative, Bruno alternative`

## Style

- Clear and searchable, not sensational.
- Developer-first language.
- Explain the practical workflow shown in the video.
- Avoid inflated claims such as "best", "only", or "revolutionary" unless the video substantiates them.
- Do not invent release dates, prices, benchmarks, or unsupported comparisons.

## Quality Check

Before finalizing, verify:

- The recommended title is concise and front-loads the main topic.
- The description's first 2 to 3 lines make sense without expanding.
- Tags are 5 to 10 relevant phrases.
- There are exactly 3 hashtags.
- All links are correct and use `https://mmt.dev` unless supplied by the user.
