import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-cleans when test globals are enabled; unmount
// between tests so queries never see a previous test's DOM.
afterEach(() => cleanup())
