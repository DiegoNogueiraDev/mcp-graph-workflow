/**
 * Beta Badge — red bolt badge to signal features in Beta.
 */
export function BetaBadge(): React.JSX.Element {
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5
                 text-[10px] font-bold uppercase tracking-wider
                 bg-red-500/15 text-red-500 rounded-full border border-red-500/30"
    >
      ⚡ Beta
    </span>
  );
}
