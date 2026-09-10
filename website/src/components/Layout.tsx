import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import HashScroll from './HashScroll'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <HashScroll />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <div>
        <Footer />
      </div>
    </div>
  )
}
