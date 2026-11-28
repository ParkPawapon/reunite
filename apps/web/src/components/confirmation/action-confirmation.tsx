'use client';

import Dialog from '@mui/material/Dialog';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ShellIcon } from '@/components/shell/shell-icon';
import {
  ConfirmationContext,
  type Confirmation,
} from './use-action-confirmation';
import styles from './action-confirmation.module.css';

export function ActionConfirmationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const detailId = useId();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [options, setOptions] = useState<Confirmation | null>(null);
  const [open, setOpen] = useState(false);
  const pending = useRef<((accepted: boolean) => void) | null>(null);

  const ask = useCallback((next: Confirmation, signal: AbortSignal) => {
    if (pending.current || signal.aborted) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const cancel = () => finish(false);
      function finish(accepted: boolean) {
        if (pending.current !== finish) return;
        pending.current = null;
        signal.removeEventListener('abort', cancel);
        setOpen(false);
        resolve(accepted);
      }
      pending.current = finish;
      signal.addEventListener('abort', cancel, { once: true });
      setOptions(next);
      setOpen(true);
    });
  }, []);
  useEffect(() => () => pending.current?.(false), []);

  return (
    <ConfirmationContext.Provider value={ask}>
      {children}
      {options && (
        <Dialog
          role="alertdialog"
          open={open}
          onClose={() => pending.current?.(false)}
          aria-labelledby={titleId}
          aria-describedby={
            [
              options.description ? descriptionId : null,
              options.detail ? detailId : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          maxWidth={false}
          transitionDuration={reducedMotion ? 0 : { enter: 180, exit: 130 }}
          slotProps={{
            paper: { className: styles.paper },
            backdrop: { className: styles.backdrop },
            transition: {
              onExited: () => {
                if (!pending.current) setOptions(null);
              },
            },
          }}
        >
          <div className={styles.content} data-tone={options.tone}>
            <span className={styles.icon}>
              <ShellIcon name={options.icon} width={24} height={24} />
            </span>
            <h2 id={titleId}>{options.title}</h2>
            {options.description && (
              <p id={descriptionId}>{options.description}</p>
            )}
            {options.detail && (
              <div className={styles.detail} id={detailId}>
                {options.detail}
              </div>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancel}
                autoFocus
                onClick={() => pending.current?.(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className={styles.confirm}
                onClick={() => pending.current?.(true)}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </ConfirmationContext.Provider>
  );
}
