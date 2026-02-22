import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Downloads from './pages/Downloads'
import Demos from './pages/Demos'
import Roadmap from './pages/Roadmap'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/demos" element={<Demos />} />
        <Route path="/roadmap" element={<Roadmap />} />
      </Route>
    </Routes>
  )
}

export default App
