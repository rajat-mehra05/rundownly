'use client';

interface VideoInfoProps {
  title?: string;
  channel?: string;
}

export default function VideoInfo({ title, channel }: VideoInfoProps) {
  if (!title && !channel) return null;

  return (
    <div className="glass-card px-6 py-4">
      {title ? <p className="font-medium text-sm">{title}</p> : null}
      {channel ? <p className="text-sm text-muted">{channel}</p> : null}
    </div>
  );
}
