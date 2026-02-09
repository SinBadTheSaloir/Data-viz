import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BookDetail from './pages/BookDetail';
import Compare from './pages/Compare';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <nav className="border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="w-24" />
          <a href="/" className="flex items-center gap-2 no-underline">
            <h1 className="text-xl font-bold text-text-primary tracking-tight m-0">
              Narrative Nexus
            </h1>
          </a>
          <div className="flex gap-4 w-24 justify-end">
            <a href="/" className="text-text-muted hover:text-text-primary text-xs no-underline transition-colors">
              Library
            </a>
            <a href="/compare" className="text-text-muted hover:text-text-primary text-xs no-underline transition-colors">
              Compare
            </a>
          </div>
        </nav>
        <main className="px-6 py-6 max-w-[1600px] mx-auto flex-1 w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/book/:bookId" element={<BookDetail />} />
            <Route path="/compare" element={<Compare />} />
          </Routes>
        </main>
        <footer className="border-t border-border px-6 py-4 text-center">
          <div className="text-xs text-text-muted">
            Narrative Nexus &mdash; Tree of Life Pipeline
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
