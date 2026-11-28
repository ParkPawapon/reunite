'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
} from 'react';
import type { ShellIcon } from '@/components/shell/shell-icon';

export type Confirmation = {
  title: string;
  description?: string;
  detail?: string;
  confirmLabel: string;
  icon: ComponentProps<typeof ShellIcon>['name'];
  tone?: 'danger';
};

export const logoutConfirmation = {
  title: 'ออกจากระบบไหม?',
  confirmLabel: 'ออกจากระบบ',
  icon: 'logout',
} satisfies Confirmation;

export const ConfirmationContext = createContext<
  ((options: Confirmation, signal: AbortSignal) => Promise<boolean>) | null
>(null);

export function useActionConfirmation() {
  const ask = useContext(ConfirmationContext);
  if (!ask) throw new Error('Action confirmation provider is missing');
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  return (options: Confirmation) => {
    const signal = lifetime.current?.signal;
    return signal ? ask(options, signal) : Promise.resolve(false);
  };
}
