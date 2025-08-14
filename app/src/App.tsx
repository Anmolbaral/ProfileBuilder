// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PdfUploader } from './components/PdfUploader';
import  ResultsPage  from './features/results/ResultsPage';

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<PdfUploader />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </Router>
  );
}

export default App;