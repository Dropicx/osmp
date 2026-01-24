import type { Track } from '../types';
import type { ContentColumnId } from '../types/columns';
import { formatDuration } from './formatting';
import { DEFAULT_TITLE, DEFAULT_ARTIST, DEFAULT_ALBUM } from '../constants';

export function getCellContent(track: Track, columnId: ContentColumnId): string {
  switch (columnId) {
    case 'title':
      return track.title || DEFAULT_TITLE;
    case 'artist':
      return track.artist || DEFAULT_ARTIST;
    case 'album':
      return track.album || DEFAULT_ALBUM;
    case 'genre':
      return track.genre || '-';
    case 'duration':
      return formatDuration(track.duration);
    default:
      return '';
  }
}
