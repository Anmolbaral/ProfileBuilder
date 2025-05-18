// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PdfUploader } from './components/PdfUploader';
import ResultsPage from './components/ResultsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PdfUploader />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
  );
}

export default App;