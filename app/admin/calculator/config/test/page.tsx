'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setPlatforms([
        { id: '1', name: 'Test Platform 1' },
        { id: '2', name: 'Test Platform 2' },
        { id: '3', name: 'Test Platform 3' }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <h1>Test Page</h1>
      <p>Platforms: {platforms.length}</p>
      {platforms.map(platform => (
        <div key={platform.id}>{platform.name}</div>
      ))}
    </div>
  );
}
