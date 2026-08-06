import { UserRound } from 'lucide-react';
import { useState } from 'react';

interface PersonPortraitProps {
  name: string;
  photoUrl: string | null;
  className?: string;
}

export function PersonPortrait({ name, photoUrl, className = '' }: PersonPortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(photoUrl) && !imageFailed;

  return (
    <div className={`person-portrait ${className}`.trim()}>
      {showImage ? (
        <img
          src={photoUrl ?? ''}
          alt={`Portrait of ${name}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="person-portrait-placeholder" aria-label={`No portrait available for ${name}`}>
          <UserRound aria-hidden="true" />
          <span>Portrait pending</span>
        </div>
      )}
    </div>
  );
}
