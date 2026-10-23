import { Typography } from "@/shared/components/typography/Typography";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <div className="mb-(--section-gap) rounded-panel border border-border bg-surface-raised p-(--section-padding)">
      <Typography variant="section-title">{title}</Typography>
      {description && (
        <Typography variant="body" className="mt-1 text-text-muted-strong">
          {description}
        </Typography>
      )}
      <div className="mt-md flex flex-col gap-(--field-gap)">{children}</div>
    </div>
  );
}
