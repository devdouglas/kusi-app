import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Application-level settings.</p>
      </div>
      <SettingsForm rateMicros={settings.rateMicros} />
    </div>
  );
}
