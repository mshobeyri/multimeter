# Show HN — سه‌شنبه ۱۸ اوت ۲۰۲۶

ساعت ۱۴ تا ۱۶ به وقت محلی. فقط همین پست. دوستان را برای آپ‌وت صدا نکن.

## چک‌لیست

- [ ] دوشنبه: صفحه Marketplace اسم **Multimeter – REST Client & API Testing** را نشان بدهد. اگر هنوز «API Testing platform» است، 1.34.1 را **stable** پابلیش کن نه pre-release.
- [ ] سه‌شنبه ۱۴–۱۶: برو به https://news.ycombinator.com/submit
- [ ] عنوان و لینک را بگذار، ثبت کن، کامنت اول را پیست کن
- [ ] همان‌جا بمان و با جواب‌های آماده پاسخ بده
- [ ] اگر دوباره ۲ امتیاز شد: سه ماه دیگر؛ پشت سر هم نگذار

پست قبلی (۲ امتیاز، صفر کامنت، Show HN نبود): https://news.ycombinator.com/item?id=48266440

---

## عنوان

```
Show HN: Multimeter – Git-native REST client and API tests in VS Code
```

## آدرس

```
https://mmt.dev
```

## کامنت اول

```
I got tired of API tests living in a cloud collection while the code lived in Git, so I built Multimeter: a VS Code REST client where requests, tests, mocks, and docs are YAML files in the repo.

No account. Apache 2.0. It also opens .http and .bru files.

Try it: install the VS Code extension, create echo.mmt:

  type: api
  url: https://test.mmt.dev/echo
  method: post
  format: json
  body:
    message: hello world

Click Send. The echo server returns what you posted.

Same files run in CI:

  - uses: mshobeyri/multimeter/.github/actions/testlight@main
    with:
      file: echo.mmt

Site: https://mmt.dev
Extension: https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter
Repo: https://github.com/mshobeyri/multimeter

Happy to answer questions.
```

---

## جواب‌های آماده

کوتاه بمان. حدس نزن. قول فیچر نده.

### 1. تعریف / باحال است

```
Thanks. If you try it, the fastest path is the echo.mmt snippet in the top comment — Send in VS Code, then the same file in CI.
```

### 2. فرقش با Bruno؟

```
Same idea as Bruno: files in Git, no cloud collection. Difference is you stay in VS Code, and the same files cover tests, suites, a local mock server, generated docs, and CI reports. It also opens .bru files, so you don't have to convert on day one.
```

### 3. فرقش با Postman؟

```
Postman is a cloud product with a desktop app. Multimeter is a VS Code extension + CLI. Requests and tests are YAML in the repo, so PRs review them like code, and local/CI use the same files. No account. You can import Postman collections if you want to try it on an existing project.
```

### 4. Thunder Client / REST Client؟

```
Those are great for sending a request inside VS Code. Multimeter starts there, but the file is Git-native YAML and the same file runs in CI via testlight. It also opens .http files directly.
```

### 5. چرا YAML؟

```
So the request is diffable in Git and readable in a PR without exporting a collection. There's also a UI in the editor if you don't want to write YAML by hand. The file is the source of truth either way.
```

### 6. بدون VS Code؟ CI؟

```
Yes. The editor is optional. CLI is testlight (npm package mmt-testlight):

  npx mmt-testlight run path/to/test.mmt

GitHub Action:

  - uses: mshobeyri/multimeter/.github/actions/testlight@main
    with:
      file: tests/suite.mmt
```

### 7. ایمپورت؟

```
Postman collections, OpenAPI/Swagger, curl, .http, Bruno .bru, and WSDL. You can open .http/.bru as-is, or convert to .mmt when you need test flows.
```

### 8. رایگان / لایسنس / داده کجا می‌رود؟

```
Apache 2.0, no account, no cloud sync. Requests run from your machine. Nothing is uploaded to us. Secrets should live in env files / CI secrets, not in the committed request body — same as any Git-native tool.
```

### 9. GraphQL / gRPC / WebSocket؟

```
HTTP, GraphQL, gRPC, WebSocket, and SOAP/XML. Auth includes oauth2 on API files. If a specific flow is missing, tell me which one and I’ll say whether it’s there or not.
```

### 10. پس Playwright / pytest؟

```
Those are better when the test is really code. Multimeter is for API checks you want next to the repo as files: send, assert, suite, mock, docs, CI report — without standing up a test framework first.
```

### 11. اسم Multimeter؟

```
Yeah, hardware search results are a mess. Site is mmt.dev, CLI is testlight, files are .mmt.
```

### 12. باگ / فیچر کم است

```
That's fair — thanks for saying it. Can you share the file or the exact step that broke? I'll reproduce it. Issues: https://github.com/mshobeyri/multimeter/issues
```

اگر مقایسه با ابزاری بود که در لیست نیست: اول بگو آن‌ها چه دارند که تو نداری، بعد یک جمله بگو Multimeter کجا را پوشش می‌دهد.
