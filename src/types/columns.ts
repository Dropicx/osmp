export type ContentColumnId = 'title' | 'artist' | 'album' | 'genre' | 'duration';

export interface ColumnConfig {
  id: ContentColumnId;
  label: string;
  minWidth: number;
  defaultWidth: number;
}
