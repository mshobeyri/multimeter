---
name: multimeter-linkedin-post
description: Generate LinkedIn posts for promoting Multimeter, Testlight, mmt.dev demos, releases, features, docs, API testing workflows, CI testing, mock servers, suites, and developer tooling. Use when the user asks for LinkedIn copy, social posts, launch posts, feature announcements, hashtags, or B2B developer marketing for Multimeter.
---

# Multimeter LinkedIn Post

## Purpose

Create LinkedIn copy that promotes Multimeter to developers, API teams, QA engineers, founders, and engineering leaders without sounding like generic SaaS marketing.

## Product Positioning

Use this core positioning unless the user gives a more specific angle:

- Multimeter is a Git-native API testing platform.
- Start with a single `.mmt` request and grow into tests, suites, mocks, reports, generated documentation, and CI workflows.
- It combines the simplicity of lightweight file-based tools with the power teams need as projects grow.
- It avoids cloud lock-in and keeps API workflows versioned with the codebase.
- The website is `https://mmt.dev`.
- The test server is `https://test.mmt.dev`.
- The CLI is Testlight, usually invoked as `npx testlight run path/to/test.mmt`.

Do not use `multimeter.dev`.

## Workflow

1. Identify the announcement type: feature, release, demo video, tutorial, comparison, docs, example, or opinion post.
2. Extract the audience and pain point from the user prompt. If missing, default to API developers and teams who have outgrown ad hoc request collections.
3. Write one main post and, when useful, 2 alternate hooks.
4. Include a clear CTA: try the extension, watch the demo, read docs, run the example, or comment with feedback.
5. Add 3 to 5 relevant hashtags at the end.
6. Keep claims accurate. If the user mentions a video, feature, or release but gives little detail, avoid claiming specifics not provided.

## LinkedIn Best Practices

- Use 3 to 5 hashtags, placed at the end.
- Prefer a mix of 1 broad industry hashtag, 2 to 3 niche topic hashtags, and optionally 1 branded hashtag.
- Use CamelCase for multi-word hashtags, for example `#APITesting`.
- Avoid more than 5 hashtags, irrelevant tags, and repeated identical tag sets.
- Lead with a concrete pain, insight, or result. Avoid "excited to announce" as the default opener.
- Keep the first 2 lines strong because they determine whether readers expand the post.
- Use short paragraphs and enough whitespace for mobile reading.
- End with one focused CTA, not several competing requests.
- For link posts, include the URL after the CTA unless the user asks for a link-free post.

## Multimeter Hashtag Library

Choose the most relevant 3 to 5 for the specific post:

- Broad: `#DeveloperTools`, `#SoftwareTesting`, `#DevOps`, `#OpenSource`, `#SaaS`
- API/testing: `#APITesting`, `#TestAutomation`, `#QualityEngineering`, `#ContractTesting`, `#APIDevelopment`
- Workflow/CI: `#CICD`, `#GitNative`, `#EngineeringProductivity`, `#DeveloperExperience`
- Product-specific: `#Multimeter`, `#Testlight`

Default hashtag set for general posts:

`#APITesting #DeveloperTools #TestAutomation #GitNative #Multimeter`

## Output Format

Return:

```markdown
LinkedIn post:
[Post text]

Hashtags:
[3-5 hashtags]

Alternate hooks:
1. [Hook]
2. [Hook]
```

If the user asks for multiple tones, provide separate labeled variants such as `Founder tone`, `Technical tone`, and `Launch tone`.

## Style

- Direct, useful, and developer-literate.
- Specific over hype.
- Short sentences are fine.
- Mention competitors only when the user asks for comparison copy, and keep comparisons fair.
- Avoid buzzwords like "revolutionary", "game-changing", "10x", and "seamless" unless the user explicitly wants a hype-heavy style.

## Quality Check

Before finalizing, verify:

- The post has a clear reader benefit.
- The first two lines are not generic.
- The CTA matches the requested goal.
- There are exactly 3 to 5 hashtags.
- The URL, if used, is `https://mmt.dev` or another user-provided valid link.
