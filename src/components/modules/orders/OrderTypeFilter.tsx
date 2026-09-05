import React from 'react';
import { Utensils, ShoppingBag, Filter } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface OrderTypeFilterProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

const OPTIONS = [
  { value: '', label: 'All Order Types', icon: Filter },
  { value: 'DINE_IN', label: 'Dine-in', icon: Utensils },
  { value: 'TAKEAWAY', label: 'Takeaway', icon: ShoppingBag },
];

export default function OrderTypeFilter({
  value,
  onChange,
  style,
  className,
  disabled = false,
}: OrderTypeFilterProps) {
  return (
    <CustomSelect
      options={OPTIONS}
      value={value}
      onChange={onChange}
      style={style}
      className={className}
      disabled={disabled}
    />
  );
}
