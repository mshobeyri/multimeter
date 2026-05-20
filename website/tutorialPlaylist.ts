export const tutorialPlaylist = {
  "id": "PL_GvdPBZ-KR4nlMq1dE8BryC75z8jzTfL",
  "eyebrow": "Step-by-step playlist",
  "title": "Watch Multimeter in action",
  "description": "Guided walkthroughs covering Multimeter from install to environment variables and API testing.",
  "videos": [
    {
      "id": "nPh6FhfklAA",
      "title": "Load Test Your APIs With Multimeter",
      "description": "In this video, I explain the new Load Test feature in Multimeter and show how you can test API performance by running real test scenarios repeatedly with concurrency, ramp-up, and detailed reporting.\\n\\nYou will learn how to create a type: loadtest file, connect it to an existing Multimeter test, configure virtual users with threads, control execution with repeat, gradually increase traffic with rampup, and export useful performance reports for local development or CI workflows.\\n\\nYou will learn:\\n\\nWhat load testing is and when to use it\\nHow to define a Multimeter load test file\\nHow to run one test scenario under repeated traffic\\nHow to configure threads, repeat limits, and ramp-up\\nHow to use environments and presets in load tests\\nHow to export load test reports as MMT, HTML, Markdown, or JUnit XML\\nHow to understand performance metrics like requests, failures, success rate, duration, and throughput\\nThis feature is especially useful when you want to validate that your APIs stay stable and reliable under pressure before releasing them to production.\\n\\nIf you found this useful, consider liking and subscribing for more practical Multimeter tutorials.\\n\\n"
    },
    {
      "id": "86CVuh4iKO4",
      "title": "Structure and Categorize Your Multimeter Files Like a Pro",
      "description": "YouTube Description:\\nIn this video, I explain how to structure and categorize your files in Multimeter so your project stays clean, scalable, and easy to maintain as it grows.\\n\\nI walk through organizing API definitions, documentation files, regression tests, and suites into separate folders, then show how to update references so everything continues working together correctly.\\n\\nYou will learn:\\n\\nHow to organize Multimeter files by purpose\\nHow to separate API definitions from regression tests\\nHow to structure suites for better maintainability\\nHow to reference files across folders using clean imports\\nWhy a good project structure matters when your API testing setup grows\\nThis is especially useful if your Multimeter project is moving beyond a few files and you want a more professional structure for real-world API testing and documentation workflows.\\n\\nIf you found this useful, consider liking and subscribing for more practical Multimeter tutorials.\\n\\n"
    },
    {
      "id": "nATZbSD-ocA",
      "title": "Master Test Suites in Multimeter — Test APIs Like a Pro",
      "description": "In this video, I walk through the Suite features in Multimeter and show how they help you organize, run, and manage groups of API tests efficiently.\\n\\nYou will learn:\\n\\nWhat a Suite is in Multimeter and when to use one\\nHow to create and structure suites for your APIs\\nHow to run tests in parallel or sequential \\nHow to run muck servers in the beginning\\nHow to export test resutls at the end\\n\\nsuites to keep your tests organized, repeatable, and easy to maintain across your entire project.\\n\\nIf you found this useful, consider liking and subscribing for more practical guides on Multimeter, API testing, and modern backend development.\\n\\n"
    },
    {
      "id": "YUtLzwq4pS0",
      "title": "Build API Mock Servers Effortlessly Using Multimeter",
      "description": "In this video, I show how to create mock servers using Multimeter, so you can build, test, and demo your applications without waiting for a real backend.\\n\\nYou will learn:\\n\\nWhat a mock server is and when to use one\\nHow to create a mock server in Multimeter step by step\\nHow to define endpoints, request structures, and response payloads\\nHow to simulate success, error, and edge-case scenarios\\nHow to integrate Multimeter mock servers into your development and testing workflow\\nMultimeter makes mock servers fast to set up and easy to maintain, helping frontend and backend teams work in parallel, accelerate prototyping, and improve testing reliability. By the end of this video, you’ll be able to spin up a fully functional mock server in Multimeter and use it to ship features faster with confidence.\\n\\nIf you found this useful, consider liking and subscribing for more practical guides on Multimeter, APIs, and modern backend development.\\n\\n"
    },
    {
      "id": "PC-wOO3YHGE",
      "title": "Stop Writing API Docs by Hand — Let Multimeter Do It",
      "description": "In this video, I walk through the documentation features of Multimeter and show how they help teams build, maintain, and share clear API documentation with minimal effort.\\n\\nYou will learn:\\n\\nHow Multimeter generates documentation directly from your API definitions\\nHow to keep documentation always in sync with the actual implementation\\nHow to describe inputs, outputs, and error responses in a structured way\\nHow to organize endpoints for readability and long-term maintainability\\nHow to share documentation with your team and stakeholders effectively\\nWhether you are building a new API or improving an existing one, Multimeter’s documentation tools help you deliver professional, reliable, and developer-friendly docs without the usual overhead.\\n\\nIf you found this useful, consider liking and subscribing for more deep dives into Multimeter and modern API development workflows.\\n\\n"
    },
    {
      "id": "PIojaO9SLTs",
      "title": "First test in Multimeter",
      "description": "in this video, I walk through writing the first test in Multimeter, step by step.\\n\\nYou will learn:\\n\\nHow to create tests with coding\\nHow to create tests without coding\\nChecking if our echo API is working\\nHow to call an API in test flow\\nWhat are reports\\nCommit the changes\\n\\nIf you want to build Multimeter with confidence and safer refactors, this is the right starting point.\\n\\n"
    },
    {
      "id": "4_171yDNomw",
      "title": "How to define input/outputs for APIs in Multimeter",
      "description": "This video explains how to define API inputs and outputs.\\n\\nIf you want your APIs to be called in test flows, you need to watch this.\\n\\n"
    },
    {
      "id": "kOZBSUVX-xk",
      "title": "Multimeter Environment Variables and Presets",
      "description": "In this video, I explained all the important environment variables used in Multimeter\\n\\nYou will learn:\\n\\nHow to create env variables manually\\nHow to generate them in .mmt files\\nHow to use them\\nWhat is preset\\n\\nDrop your questions in the comments and I’ll help you out.\\n\\n"
    },
    {
      "id": "0FsePHfaKSg",
      "title": "Basic API testing in Multimeter",
      "description": "Learn how to run a basic API test in Multimeter from start to finish.\\nIn this tutorial, I walk through a practical workflow for beginners and show each core step clearly.\\n\\nWhat I covered in this video:\\n\\nHow to create a new API test\\nHow to use the POST method\\nHow to test both JSON and XML responses\\nHow to add custom headers\\nHow to commit your test changes\\nIf you are starting API testing with Multimeter, this video gives you a quick and clean foundation you can reuse in real projects.\\n\\nLike, comment, and subscribe for more Multimeter testing tutorials.\\n\\n"
    },
    {
      "id": "Ga_GhG2Ry0s",
      "title": "Install Multimeter and get rid of all other test tools",
      "description": "In this video, you’ll learn how to:\\n\\nInstall Multimeter extention on vscode\\nShort overview of the panels\\n\\n"
    }
  ]
} as const;
