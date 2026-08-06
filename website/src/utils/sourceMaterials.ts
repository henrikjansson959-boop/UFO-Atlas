import {
  Archive,
  BookOpen,
  FileText,
  FolderOpen,
  Headphones,
  Image,
  MessageCircle,
  Newspaper,
  UserRound,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SourceMaterialType } from '../types';

export type SourceMaterialOption = {
  value: SourceMaterialType;
  label: string;
  icon: LucideIcon;
};

export const SOURCE_MATERIALS: SourceMaterialOption[] = [
  { value: 'article', label: 'Articles', icon: Newspaper },
  { value: 'document', label: 'Documents', icon: FileText },
  { value: 'forum', label: 'Forums', icon: MessageCircle },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'image', label: 'Images', icon: Image },
  { value: 'archive', label: 'Archives', icon: Archive },
  { value: 'book', label: 'Books', icon: BookOpen },
  { value: 'podcast', label: 'Podcasts', icon: Headphones },
  { value: 'witness_report', label: 'Witness reports', icon: UserRound },
  { value: 'news_report', label: 'News reports', icon: Newspaper },
  { value: 'case_file', label: 'Case files', icon: FolderOpen },
];

export function getSourceMaterial(value: SourceMaterialType): SourceMaterialOption {
  return SOURCE_MATERIALS.find((item) => item.value === value) ?? SOURCE_MATERIALS[0];
}
