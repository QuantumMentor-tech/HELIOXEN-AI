import React from 'react'
import { AppShell } from './components/layout'
import { CommandCenter } from './components/workspace'

export const App: React.FC = () => {
  return (
    <AppShell title="HELIOXEN AI" statusText="STANDBY">
      <CommandCenter />
    </AppShell>
  )
}

export default App
