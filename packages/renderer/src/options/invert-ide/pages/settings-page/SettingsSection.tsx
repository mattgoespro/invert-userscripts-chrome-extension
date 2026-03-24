import { Typography } from "@/shared/components/typography/Typography";

type SettingsSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="bg-surface-raised border-border rounded-default mb-(--section-gap) border p-(--section-padding)">
      <Typography variant="section-title">
        <span className="text-text-muted-faint mr-1.5">//</span>
        {title}
      </Typography>
      <div className="flex flex-col gap-(--field-gap)">{children}</div>
    </div>
  );
}
