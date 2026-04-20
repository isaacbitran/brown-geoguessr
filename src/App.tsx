import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home';
import Play from './routes/Play';
import Results from './routes/Results';
import HowToPlay from './routes/HowToPlay';
import Curate from './routes/Curate';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play" element={<Play />} />
      <Route path="/results" element={<Results />} />
      <Route path="/how" element={<HowToPlay />} />
      <Route path="/curate" element={<Curate />} />
    </Routes>
  );
}
