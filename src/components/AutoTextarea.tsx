import React, { useEffect, useRef } from 'react';

interface Props {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
  spellCheck?: boolean;
}

/** Auto-growing textarea — height adjusts to content automatically. */
export const AutoTextarea: React.FC<Props> = ({
  value,
  placeholder,
  onChange,
  className,
  spellCheck = true,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      spellCheck={spellCheck}
      className={className}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
