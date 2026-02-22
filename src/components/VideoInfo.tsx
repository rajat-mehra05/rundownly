'use client';

interface VideoInfoProps {
  title?: string;
  channel?: string;
  videoId?: string;
}

export default function VideoInfo({ title, channel, videoId }: VideoInfoProps) {
  if (!title && !channel) return null;

  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

  return (
    <div className="video-info-card glass-card">
      {thumbnailUrl ? (
        <a
          href={videoUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="video-info-thumbnail-link"
        >
          <img
            src={thumbnailUrl}
            alt=""
            width={320}
            height={180}
            className="video-info-thumbnail"
          />
        </a>
      ) : null}
      <div className="video-info-details">
        {title ? (
          videoUrl ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-info-title"
            >
              {title}
            </a>
          ) : (
            <p className="video-info-title">{title}</p>
          )
        ) : null}
        {channel ? <span className="video-info-channel">{channel}</span> : null}
      </div>
    </div>
  );
}
