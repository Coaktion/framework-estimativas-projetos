import { foldersConfigured } from '@/lib/folders';
import FoldersClient from './FoldersClient';

export default function FoldersPage() {
  return <FoldersClient configured={foldersConfigured()} />;
}
