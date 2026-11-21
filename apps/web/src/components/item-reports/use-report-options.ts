import { useEffect, useState } from 'react';
import {
  loadReportOptions,
  type ReportOption,
} from '@/modules/item-reports/presentation/reports-client';

type OptionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      categories: ReportOption[];
      locations: ReportOption[];
    };

export function useReportOptions() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OptionsState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    loadReportOptions(controller.signal)
      .then((options) => setState({ status: 'ready', ...options }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };
  return { state, retry };
}
