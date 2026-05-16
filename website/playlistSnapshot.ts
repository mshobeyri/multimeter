export const playlistSnapshot = [
  {
    id: 'PL_GvdPBZ-KR6cTAyzewASaUDbZt_B9POH',
    eyebrow: 'Feature demos',
    title: 'Short Multimeter feature demos',
    description: 'Quick, focused videos showing Multimeter features in action.',
    videos: [
      {
        id: 'U3Fyhtv-_iM',
        title: 'Multimeter API: Create first JSON Request',
        description: 'This example shows the basic structure of an API file in Multimeter. An API definition starts with `type: api`, then defines the target `url`, HTTP `method`, body `format`, and request `body`. In this case, the API sends a JSON POST request to the echo endpoint and the video demonstrates testing that request.\\n\\n```yaml\\ntype: api\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: mehrdad\\n password: 123456\\n```\\n\\n',
      },
      {
        id: 'Oqcr-BqA4K4',
        title: 'Multimeter API: Send an XML Request Body',
        description: 'This example uses the same API structure but changes the body format to XML. Multimeter lets the request body be written as structured YAML, then sends it using the selected format. The video tests an XML-style envelope that contains a header and body section. You can use this feature to test requests instead of tools like .\\n\\n```yaml\\ntype: api\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: xml\\nbody:\\n envelop:\\n header:\\n application: multimeter\\n body:\\n username: mehrdad\\n password: 123456\\n```\\n\\n',
      },
      {
        id: 'J5KXnDmRG2Y',
        title: 'Multimeter API: Use Raw JSON Text in the Body',
        description: 'Multimeter can send JSON from a raw text block when you need exact control over the payload. The `|-` block keeps the nested JSON body as text instead of converting it from YAML fields. The video tests that the raw JSON payload is sent correctly. \\n\\n```yaml\\ntype: api\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody: |-\\n {\\n \\\"envelop\\\": {\\n \\\"header\\\": {\\n \\\"application\\\": \\\"multimeter\\\"\\n },\\n \\\"body\\\": {\\n \\\"username\\\": \\\"mehrdad\\\",\\n \\\"password\\\": 123456\\n }\\n }\\n }\\n```\\n\\n',
      },
      {
        id: '9dQnLa9v1EQ',
        title: 'Multimeter API: Define Inputs and Reuse Them',
        description: 'Inputs let an API file become reusable. Values are declared under `inputs` and referenced later with `i:name`. In this example, `i:user` and `i:pass` fill the JSON request body, and the video tests that input substitution works before the API call is sent. Later you can see we can reuse this API by passing different inputs to it.\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'lf2PPGmOmK4',
        title: 'Multimeter API: Extract Outputs from a Response',
        description: 'Outputs define which values should be captured from the API response. This makes response data available for checks in a test file or for later steps in a flow. The example extracts response headers and echoed body fields, and the video tests that each output is resolved correctly. You can also see that here for outputs, we don\'t have defaults. So:\\ninputs: defaults\\noutputs: xpath or regex\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n connection: body.headers.connection\\n user-agent: body.headers.user-agent\\n username: body.body.username\\n password: body.body.password\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'my0F1sKaqdQ',
        title: 'Multimeter API: Extract Output Values with Regex',
        description: 'An output can also be extracted with a regular expression when the needed value is easier to find in raw text. This example keeps path-based outputs for normal response fields and adds a regex output for the request method. The video tests both extraction styles in the same API file.\\n\\n```\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n connection: body.headers.connection\\n user-agent: body.headers.user-agent\\n username: body.body.username\\n password: body.body.password\\n method: method\\\":\\\\s\\\"(.*)\\\",\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'vy8u4slbZ7A',
        title: 'Multimeter API: Test a WebSocket Endpoint',
        description: 'Multimeter API definitions can also target WebSocket URLs. The file keeps the same input, output, format, and body structure, but uses a `ws://` endpoint. The video tests sending the request through the WebSocket endpoint and reading the echoed outputs. Multimeter automatically consider this request as a websocket request, but you can also specify that explicitly via `protocol` key.\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n username: body.body.username\\n password: body.body.password\\nurl: ws://test.mmt.dev/ws\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n',
      },
      {
        id: 'bjsO5CQ0siU',
        title: 'Multimeter API: No-Code Request Example',
        description: 'Here you can learn how to generate tests without a line of coding and just using UI.\\n\\n```yaml\\ntype: api\\nurl: http://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n message: hi\\n```\\n\\n',
      },
      {
        id: 'FiP-KAkXqkw',
        title: 'Multimeter API: Defining Examples for your API',
        description: 'In this video you can see how to define examples for an API. This examples can be simply valid or invalid inputs. They can be used for smoke testing, and later you can see they will be published in the docs.\\n\\n```yaml\\ntype: api \\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n username: body.body.username \\n password: body.body.password \\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\nexamples:\\n - name: Davood user login\\n inputs:\\n user: Davood\\n pass: 123\\n```\\n\\n',
      },
      {
        id: 'nrfwwchC7vE',
        title: 'Multimeter Env Variables: Use a Manually added URL',
        description: 'Environment variables let a file avoid hard-coded values. The API URL uses `e:url`, which means the value comes from the selected environment. The video tests the same request while the URL is provided outside the API file.\\n\\n```yaml\\ntype: api\\nurl: e:url\\nmethod: post\\nformat: json\\nbody:\\n message: hi\\n```\\n\\n',
      },
      {
        id: 'jw0aauHwcrk',
        title: 'Multimeter Env Variables: Define Reusable Multimeter Environment Variables',
        description: 'We can keep environment variables as code. An environment file stores values that can be reused by API files. Here, the API references `e:url`, while the environment defines both WebSocket and HTTP URL options. The video tests switching the request target through the environment value.\\n\\n```yaml\\ntype: api\\nurl: e:url\\nmethod: post\\nformat: json\\nbody:\\n message: hi\\n```\\n\\n```yaml\\ntype: env\\nvariables:\\n url:\\n websocket: ws://test.mmt.dev/ws\\n http: http://test.mmt.dev/echo\\n```\\n\\n',
      },
      {
        id: 'o9Ga1fn64do',
        title: 'Multimeter Env Variables: Presets or how to change multiple env variables together',
        description: 'Presets group environment variable choices together. The API builds its URL from `e:url` and `e:endpoint`, while the environment file defines REST and WebSocket presets. The video tests how a preset changes multiple values at once.\\n\\n```yaml\\ntype: api\\nurl: {{e:url}}{{e:endpoint}}\\nmethod: post\\nformat: json\\nbody:\\n message: hi\\n```\\n\\n```yaml\\ntype: env\\nvariables:\\n url:\\n websocket: ws://test.mmt.dev\\n http: http://test.mmt.dev\\n endpoint:\\n websocket: /ws\\n http: /echo\\npresets:\\n env:\\n ws:\\n url: websocket\\n endpoint: websocket\\n rest:\\n url: http\\n endpoint: http\\n```\\n\\n',
      },
      {
        id: 'IE0Um0jNnGs',
        title: 'Multimeter Test: First Multimeter functional test',
        description: 'A test file can import an API file, call it with custom inputs, and compare extracted outputs with expected values. This example imports `api.mmt` as `echo_api`, sends new input values, and verifies that the response contains the same username and password. The video tests the final `.mmt` API file through a simple test case.\\n\\n```yaml\\ntype: test\\nimport:\\n echo_api: api.mmt\\nsteps:\\n - call: echo_api\\n inputs:\\n user: sahar\\n pass: 345678\\n expect:\\n username: sahar\\n password: 345678\\n```\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n username: body.body.username\\n password: body.body.password\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'KmmtetyRY3E',
        title: 'Multimeter Test: No code mode for writing test flows',
        description: 'Test flows can combine timing, repeated actions, API calls, and expectations. This example waits for three seconds, repeats the API call twice, and validates the returned outputs each time. The video tests the final imported API file inside a flow-style test.\\n\\n```yaml\\ntype: test\\nimport:\\n echo_api: api.mmt\\nsteps:\\n - delay: 3s\\n - repeat: \"2\"\\n steps:\\n - call: echo_api\\n inputs:\\n user: sahar\\n pass: 345678\\n expect:\\n username: sahar\\n password: 345678\\n```\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n username: body.body.username\\n password: body.body.password\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'ZjZNNFFL_1c',
        title: 'Multimeter Test: Parallel test flows',
        description: 'Stages will be run in parallel in the test flow. This example will call echo API with two different set of inputs at the same time and for 2 seconds.\\n\\n```yaml\\ntype: test\\nimport:\\n echo_api: api.mmt\\nstages:\\n - id: stage_1\\n steps:\\n - repeat: 2s\\n steps:\\n - call: echo_api\\n inputs:\\n user: sahar\\n pass: 345678\\n expect:\\n username: sahar\\n password: 345678\\n - id: stage_2\\n steps:\\n - repeat: 2s\\n steps:\\n - call: echo_api\\n inputs:\\n user: mehrdad\\n pass: 123\\n expect:\\n username: mehrdad\\n password: 123\\n```\\n\\n```yaml\\ntype: api\\ninputs:\\n user: mehrdad\\n pass: 123456\\noutputs:\\n username: body.body.username\\n password: body.body.password\\nurl: https://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n username: i:user\\n password: i:pass\\n```\\n\\n',
      },
      {
        id: 'Kzw4zT8tBkc',
        title: 'Multimeter Document:  `title` and `description`',
        description: 'For all types of .mmt files, you can add `title` and `description`. They have different usecases, but the main usecase is documenting. Here you can see how we added those field and the view we get in doc tab. Descriptoin support markdown basic features as well.\\n\\n```\\ntype: api\\ndescription: Send a JSON message to the echo endpoint and verify the request can be tested in Multimeter.\\nurl: http://test.mmt.dev/echo\\nmethod: post\\nformat: json\\nbody:\\n message: hi\\n```\\n\\n',
      },
      {
        id: 'pjOGbekeq3M',
        title: 'Multimeter Document:  Reference .md in MMT API description',
        description: 'Somtimes desciptions can be too long and also inline descriptions cannot support all md features because of yaml limitations. You can reference to an md file for that. the format is {file.md}#{header-with-dash-instead-of-space}.\\n\\n',
      },
      {
        id: 'U568o0xF2vU',
        title: 'Multimeter Document: How to generate API documentation with 3 lines of YAML code',
        description: 'Now that you have all your API files available, you can easily pass their pathes to `type: doc` .mmt file and it will generate you triable HTML and Markdown API documents. There are also more features there to resove env variables, categorise you APIs and more...\\n\\n```\\ntype: doc\\nsources:\\n - api\\n```\\n\\n',
      },
    ],
  },
  {
    id: 'PL_GvdPBZ-KR4nlMq1dE8BryC75z8jzTfL',
    eyebrow: 'Step-by-step playlist',
    title: 'Watch Multimeter in action',
    description: 'Guided walkthroughs covering Multimeter from install to environment variables and API testing.',
    videos: [
      {
        id: 'nPh6FhfklAA',
        title: 'Load Test Your APIs With Multimeter',
        description: 'In this video, I explain the new Load Test feature in Multimeter and show how you can test API performance by running real test scenarios repeatedly with concurrency, ramp-up, and detailed reporting.\\n\\nYou will learn how to create a type: loadtest file, connect it to an existing Multimeter test, configure virtual users with threads, control execution with repeat, gradually increase traffic with rampup, and export useful performance reports for local development or CI workflows.\\n\\nYou will learn:\\n\\nWhat load testing is and when to use it\\nHow to define a Multimeter load test file\\nHow to run one test scenario under repeated traffic\\nHow to configure threads, repeat limits, and ramp-up\\nHow to use environments and presets in load tests\\nHow to export load test reports as MMT, HTML, Markdown, or JUnit XML\\nHow to understand performance metrics like requests, failures, success rate, duration, and throughput\\nThis feature is especially useful when you want to validate that your APIs stay stable and reliable under pressure before releasing them to production.\\n\\nIf you found this useful, consider liking and subscribing for more practical Multimeter tutorials.\\n\\n',
      },
      {
        id: '86CVuh4iKO4',
        title: 'Structure and Categorize Your Multimeter Files Like a Pro',
        description: 'YouTube Description:\\nIn this video, I explain how to structure and categorize your files in Multimeter so your project stays clean, scalable, and easy to maintain as it grows.\\n\\nI walk through organizing API definitions, documentation files, regression tests, and suites into separate folders, then show how to update references so everything continues working together correctly.\\n\\nYou will learn:\\n\\nHow to organize Multimeter files by purpose\\nHow to separate API definitions from regression tests\\nHow to structure suites for better maintainability\\nHow to reference files across folders using clean imports\\nWhy a good project structure matters when your API testing setup grows\\nThis is especially useful if your Multimeter project is moving beyond a few files and you want a more professional structure for real-world API testing and documentation workflows.\\n\\nIf you found this useful, consider liking and subscribing for more practical Multimeter tutorials.\\n\\n',
      },
      {
        id: 'nATZbSD-ocA',
        title: 'Master Test Suites in Multimeter — Test APIs Like a Pro',
        description: 'In this video, I walk through the Suite features in Multimeter and show how they help you organize, run, and manage groups of API tests efficiently.\\n\\nYou will learn:\\n\\nWhat a Suite is in Multimeter and when to use one\\nHow to create and structure suites for your APIs\\nHow to run tests in parallel or sequential \\nHow to run muck servers in the beginning\\nHow to export test resutls at the end\\n\\nsuites to keep your tests organized, repeatable, and easy to maintain across your entire project.\\n\\nIf you found this useful, consider liking and subscribing for more practical guides on Multimeter, API testing, and modern backend development.\\n\\n',
      },
      {
        id: 'YUtLzwq4pS0',
        title: 'Build API Mock Servers Effortlessly Using Multimeter',
        description: 'In this video, I show how to create mock servers using Multimeter, so you can build, test, and demo your applications without waiting for a real backend.\\n\\nYou will learn:\\n\\nWhat a mock server is and when to use one\\nHow to create a mock server in Multimeter step by step\\nHow to define endpoints, request structures, and response payloads\\nHow to simulate success, error, and edge-case scenarios\\nHow to integrate Multimeter mock servers into your development and testing workflow\\nMultimeter makes mock servers fast to set up and easy to maintain, helping frontend and backend teams work in parallel, accelerate prototyping, and improve testing reliability. By the end of this video, you’ll be able to spin up a fully functional mock server in Multimeter and use it to ship features faster with confidence.\\n\\nIf you found this useful, consider liking and subscribing for more practical guides on Multimeter, APIs, and modern backend development.\\n\\n',
      },
      {
        id: 'PC-wOO3YHGE',
        title: 'Stop Writing API Docs by Hand — Let Multimeter Do It',
        description: 'In this video, I walk through the documentation features of Multimeter and show how they help teams build, maintain, and share clear API documentation with minimal effort.\\n\\nYou will learn:\\n\\nHow Multimeter generates documentation directly from your API definitions\\nHow to keep documentation always in sync with the actual implementation\\nHow to describe inputs, outputs, and error responses in a structured way\\nHow to organize endpoints for readability and long-term maintainability\\nHow to share documentation with your team and stakeholders effectively\\nWhether you are building a new API or improving an existing one, Multimeter’s documentation tools help you deliver professional, reliable, and developer-friendly docs without the usual overhead.\\n\\nIf you found this useful, consider liking and subscribing for more deep dives into Multimeter and modern API development workflows.\\n\\n',
      },
      {
        id: 'PIojaO9SLTs',
        title: 'First test in Multimeter',
        description: 'in this video, I walk through writing the first test in Multimeter, step by step.\\n\\nYou will learn:\\n\\nHow to create tests with coding\\nHow to create tests without coding\\nChecking if our echo API is working\\nHow to call an API in test flow\\nWhat are reports\\nCommit the changes\\n\\nIf you want to build Multimeter with confidence and safer refactors, this is the right starting point.\\n\\n',
      },
      {
        id: '4_171yDNomw',
        title: 'How to define input/outputs for APIs in Multimeter',
        description: 'This video explains how to define API inputs and outputs.\\n\\nIf you want your APIs to be called in test flows, you need to watch this.\\n\\n',
      },
      {
        id: 'kOZBSUVX-xk',
        title: 'Multimeter Environment Variables and Presets',
        description: 'In this video, I explained all the important environment variables used in Multimeter\\n\\nYou will learn:\\n\\nHow to create env variables manually\\nHow to generate them in .mmt files\\nHow to use them\\nWhat is preset\\n\\nDrop your questions in the comments and I’ll help you out.\\n\\n',
      },
      {
        id: '0FsePHfaKSg',
        title: 'Basic API testing in Multimeter',
        description: 'Learn how to run a basic API test in Multimeter from start to finish.\\nIn this tutorial, I walk through a practical workflow for beginners and show each core step clearly.\\n\\nWhat I covered in this video:\\n\\nHow to create a new API test\\nHow to use the POST method\\nHow to test both JSON and XML responses\\nHow to add custom headers\\nHow to commit your test changes\\nIf you are starting API testing with Multimeter, this video gives you a quick and clean foundation you can reuse in real projects.\\n\\nLike, comment, and subscribe for more Multimeter testing tutorials.\\n\\n',
      },
      {
        id: 'Ga_GhG2Ry0s',
        title: 'Install Multimeter and get rid of all other test tools',
        description: 'In this video, you’ll learn how to:\\n\\nInstall Multimeter extention on vscode\\nShort overview of the panels\\n\\n',
      },
    ],
  },
] as const
