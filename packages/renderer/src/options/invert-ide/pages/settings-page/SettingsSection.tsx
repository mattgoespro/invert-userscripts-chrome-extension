import { Typography } from "@/shared/components/typography/Typography";

type SettingsSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="mb-(--section-gap) rounded-default border border-border bg-surface-raised p-(--section-padding)">
      <Typography variant="section-title" className="mb-4">
        <span className="mr-1.5 text-text-muted-strong">//</span>
        {title}
      </Typography>
      <div className="flex flex-col gap-(--field-gap)">{children}</div>
    </div>
  );
}
