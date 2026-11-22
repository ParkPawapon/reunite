'use client';

import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { ShellIcon } from '@/components/shell/shell-icon';
import type { ReportOption } from '@/modules/item-reports/presentation/reports-client';

export type ChoiceProps = {
  id: string;
  error?: string;
  label: string;
  placeholder: string;
  value: string;
  options: ReportOption[];
  onChange: (value: string) => void;
};

const filterLocations = createFilterOptions<ReportOption>({ trim: true });

// Labels sit above each field, so the outline must not reserve a notch for them.
const baseSlots = {
  inputLabel: { shrink: true },
  input: { notched: false, label: '' },
} as const;

export function ReportLocationChoice({
  id,
  label,
  placeholder,
  value,
  options,
  error,
  onChange,
  disabled,
}: ChoiceProps & { disabled?: boolean }) {
  return (
    <Autocomplete
      id={id}
      fullWidth
      disabled={disabled}
      openOnFocus
      options={options}
      value={options.find((option) => String(option.id) === value) ?? null}
      onChange={(_, selected) => onChange(selected ? String(selected.id) : '')}
      getOptionLabel={(option) => option.name}
      getOptionKey={(option) => option.id}
      filterOptions={filterLocations}
      popupIcon={<ShellIcon name="chevron" />}
      openText="เปิดรายการสถานที่"
      closeText="ปิดรายการสถานที่"
      clearText="ล้างสถานที่"
      noOptionsText={options.length ? 'ไม่พบสถานที่' : 'ยังไม่มีตัวเลือก'}
      slotProps={{
        listbox: {
          sx: {
            maxHeight: 'min(21rem, 50dvh)',
            overscrollBehavior: 'contain',
            paddingBlock: 0,
            '& .MuiAutocomplete-option': {
              minHeight: '3rem',
              overflowWrap: 'anywhere',
            },
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          required
          label={label}
          placeholder={placeholder}
          error={Boolean(error)}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            inputLabel: {
              ...params.slotProps.inputLabel,
              ...baseSlots.inputLabel,
            },
            input: { ...params.slotProps.input, ...baseSlots.input },
          }}
        />
      )}
    />
  );
}
