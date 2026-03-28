import { Languages } from "lucide-react";

export function LanguagesTab(): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-muted">
      <Languages className="w-12 h-12 opacity-50" />
      <h2 className="text-lg font-semibold text-foreground">Language Convert</h2>
      <p className="text-sm max-w-md text-center">
        Translate code between programming languages using UCR construct mapping,
        confidence scoring, and AI-assisted translation.
      </p>
      <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full">Beta</span>
    </div>
  );
}
