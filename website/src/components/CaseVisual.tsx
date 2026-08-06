import { Radar } from 'lucide-react';
import { useState } from 'react';

interface CaseVisualProps {
  title: string;
  imageUrl: string | null;
  className?: string;
}

export function CaseVisual({ title, imageUrl, className = '' }: CaseVisualProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div className={`case-visual ${className}`.trim()}>
      {showImage ? (
        <img
          src={imageUrl ?? ''}
          alt={`Archive image for ${title}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="case-visual-placeholder" aria-label={`No archive image available for ${title}`}>
          <Radar aria-hidden="true" />
          <span>Case image pending</span>
        </div>
      )}
    </div>
  );
}
