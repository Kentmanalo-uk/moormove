import { createContext, useContext } from 'react';

/** The signed-in area's places (sidebar groups, tabs), for the phone ⋯ menu. */
export const ShellContext = createContext(null);
export const useShell = () => useContext(ShellContext);
