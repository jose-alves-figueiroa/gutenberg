/** Tab navigation shared by the views (e.g. "Apresentar agora" opens the Present tab). */
import { createContext, useContext } from 'react'
import type { TabId } from './tabs'

export const NavigationContext = createContext<(tab: TabId) => void>(() => {})

export const useNavigate = () => useContext(NavigationContext)
