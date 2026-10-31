import React from 'react'

export const App: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center p-8 bg-[#070a10] text-gray-300 font-sans">
      <div className="max-w-md w-full border border-sky-900/50 bg-[#0d121d] rounded-lg p-6 shadow-xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold mb-4">
          HX
        </div>
        
        <h1 className="text-xl font-semibold text-white tracking-wide mb-1">
          HELIOXEN AI
        </h1>
        <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider mb-4">
          Foundation Bootstrap • Step 5 of 48
        </p>

        <div className="bg-[#131b2a] border border-gray-800 rounded p-3 text-left text-xs font-mono space-y-1.5 text-gray-400 mb-6">
          <div className="flex justify-between">
            <span>Runtime:</span>
            <span className="text-gray-200">Electron v33 LTS</span>
          </div>
          <div className="flex justify-between">
            <span>Pipeline:</span>
            <span className="text-gray-200">electron-vite + Vite 5</span>
          </div>
          <div className="flex justify-between">
            <span>Frontend:</span>
            <span className="text-gray-200">React 18 + TypeScript 5</span>
          </div>
          <div className="flex justify-between">
            <span>Sandbox Isolation:</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
          <div className="flex justify-between">
            <span>Node Integration:</span>
            <span className="text-emerald-400">DISABLED (Secure)</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 italic">
          Temporary development bootstrap. Full UI, 3-panel command center, and AI Core will be implemented in subsequent roadmap steps.
        </p>
      </div>
    </div>
  )
}

export default App
