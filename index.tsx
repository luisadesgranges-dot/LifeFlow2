
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log("LifeFlow: Iniciando bootstrapping...");

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("LifeFlow: Renderização inicial concluída.");
  } catch (error) {
    console.error("LifeFlow: Erro fatal na montagem:", error);
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px;">
        <h1 style="color:#ef4444; font-weight:900;">Erro de Inicialização</h1>
        <p style="color:#64748b;">Não foi possível carregar os módulos do sistema.</p>
        <pre style="background:#f1f5f9; padding:15px; border-radius:10px; font-size:12px; margin-top:10px;">${error instanceof Error ? error.message : String(error)}</pre>
        <button onclick="location.reload()" style="margin-top:20px; background:#6366f1; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tentar Novamente</button>
      </div>
    `;
  }
} else {
  console.error("LifeFlow: Elemento #root não encontrado no DOM.");
}
