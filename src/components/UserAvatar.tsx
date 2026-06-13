import React, { useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';

type UserAvatarProps = {
  name: string;
  src?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function getInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (tokens.length === 0) return '';
  return tokens.map((token) => token[0]?.toUpperCase() || '').join('');
}

export default function UserAvatar({
  name,
  src,
  alt,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <span className={`pvx-avatar ${className}`.trim()} aria-label={alt || `${name} avatar`}>
      {showImage ? (
        <img
          src={src}
          alt={alt || `${name} avatar`}
          className={`pvx-avatar-image ${imageClassName}`.trim()}
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span className={`pvx-avatar-fallback ${fallbackClassName}`.trim()} aria-hidden="true">
          {initials}
        </span>
      ) : (
        <span className={`pvx-avatar-icon ${fallbackClassName}`.trim()} aria-hidden="true">
          <UserRound className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}
