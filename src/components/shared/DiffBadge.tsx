export default function DiffBadge({ level }: { level: string }) {
  const tones: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tones[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
      {level}
    </span>
  );
}
