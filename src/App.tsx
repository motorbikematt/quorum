
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RegistryProvider } from './context/RegistryContext';
import { PassGenerator } from './components/PassGenerator';
import { Kiosk } from './components/Kiosk';
import { DemoControl } from './components/DemoControl';

function App() {
  return (
    <RegistryProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/pass" replace />} />
          <Route path="/pass" element={<PassGenerator />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/demo" element={<DemoControl />} />
        </Routes>
      </Router>
    </RegistryProvider>
  );
}

export default App;
