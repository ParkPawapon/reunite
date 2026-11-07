'use client';
import { createContext, useContext } from 'react';

const ShellMotion = createContext(false);
export const ShellMotionProvider = ShellMotion.Provider;
export const useShellMotion = () => useContext(ShellMotion);
