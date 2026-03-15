import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import Demos from './pages/Demos'
import Roadmap from './pages/Roadmap'
import TestServer from './pages/TestServer'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/demos" element={<Demos />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/test-server" element={<TestServer />} />
      </Route>
    </Routes>
  )
}

export default App
