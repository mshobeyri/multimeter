import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import Demos from './pages/Demos'
import Tutorials from './pages/Tutorials'
import Roadmap from './pages/Roadmap'
import TestServer from './pages/TestServer'
import DocsLayout from './pages/docs/DocsLayout'
import DocPage from './pages/docs/DocPage'
import { ExampleDetailPage, ExamplesIndexPage } from './pages/docs/ExamplesPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/demos" element={<Demos />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/test-server" element={<TestServer />} />

        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to="getting-started" replace />} />
          <Route path="examples" element={<ExamplesIndexPage />} />
          <Route path="examples/:tier/:slug" element={<ExampleDetailPage />} />
          <Route path="*" element={<DocPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
