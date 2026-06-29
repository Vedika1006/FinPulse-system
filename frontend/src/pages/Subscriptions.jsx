import { RefreshCcw } from "lucide-react";

export default function Subscriptions() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <RefreshCcw className="mb-4 h-12 w-12 text-cyan-500" strokeWidth={1.5} aria-hidden />
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Subscriptions</h2>
      <p className="text-sm text-gray-500 dark:text-app-muted">
        This feature is coming soon. We are building it next.
      </p>
    </div>
  );
}
